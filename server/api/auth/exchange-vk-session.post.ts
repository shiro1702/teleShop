import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

interface ExchangeSessionBody {
  token?: string
}

async function findAuthUserIdByEmail(
  serviceClient: Awaited<ReturnType<typeof serverSupabaseServiceRole>>,
  email: string,
): Promise<string | null> {
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users ?? []
    const hit = users.find((user) => (user.email || '').toLowerCase() === email.toLowerCase())
    if (hit?.id) return hit.id
    if (users.length < perPage) break
    page += 1
  }
  return null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ExchangeSessionBody>(event)
  if (!body?.token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = (config.supabaseUrl as string) || ''
  const supabaseAnonKey = (config.public.supabaseKey as string) || ''
  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({ statusCode: 500, statusMessage: 'Supabase URL or anon key missing' })
  }

  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: tokenRow, error: tokenError } = await serviceClient
    .from('auth_tokens')
    .select('*')
    .eq('token', body.token)
    .eq('channel', 'vk')
    .maybeSingle()
  if (tokenError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check VK token' })
  }
  if (!tokenRow) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid VK token' })
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await serviceClient.from('auth_tokens').delete().eq('token', body.token)
    throw createError({ statusCode: 400, statusMessage: 'Token expired' })
  }

  const vkUserId = String(tokenRow.vk_user_id || '').trim()
  if (!vkUserId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'VK confirmation pending',
    })
  }

  const bridgePayload = (tokenRow.bridge_payload as Record<string, unknown> | null) || {}
  const vkEmail = typeof bridgePayload.vk_email === 'string' ? bridgePayload.vk_email.trim() : ''
  const vkPhone = typeof bridgePayload.vk_phone === 'string' ? bridgePayload.vk_phone.trim() : ''

  const { data: existingProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('vk_user_id', vkUserId)
    .maybeSingle()
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to prepare VK profile' })
  }

  const syntheticEmail = `vk_${vkUserId.replace(/[^a-zA-Z0-9._-]/g, '_')}@vk.local`
  const secret = (config.sessionSecret as string) || 'vk-session-secret'
  const syntheticPassword = crypto.createHash('sha256').update(`${vkUserId}:${secret}`).digest('hex')

  let userId: string
  if (!existingProfile) {
    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: {
        vk_user_id: vkUserId,
        ...(vkPhone ? { phone: vkPhone } : {}),
      },
    })
    if (createUserError || !createdUser?.user) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create VK user' })
    }
    userId = createdUser.user.id
    const { error: upsertError } = await serviceClient.from('profiles').upsert(
      {
        id: userId,
        vk_user_id: vkUserId,
        vk_email: vkEmail || null,
        vk_phone: vkPhone || null,
      },
      { onConflict: 'id' },
    )
    if (upsertError) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to link VK profile' })
    }
  } else {
    userId = String(existingProfile.id)
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
    })
    if (updateError) {
      const message = String(updateError.message || '').toLowerCase()
      const isEmailConflict =
        message.includes('email') &&
        (message.includes('already') || message.includes('exists') || message.includes('duplicate'))
      if (!isEmailConflict) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to prepare existing VK user' })
      }
      const syntheticUserId = await findAuthUserIdByEmail(serviceClient, syntheticEmail)
      if (!syntheticUserId) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to repair VK user mapping' })
      }
      const { error: normalizeError } = await serviceClient.auth.admin.updateUserById(syntheticUserId, {
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: {
          vk_user_id: vkUserId,
          ...(vkPhone ? { phone: vkPhone } : {}),
        },
      })
      if (normalizeError) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to normalize synthetic VK user' })
      }
      const { error: rebindError } = await serviceClient
        .from('profiles')
        .update({
          id: syntheticUserId,
          vk_user_id: vkUserId,
          vk_email: vkEmail || null,
          vk_phone: vkPhone || null,
        })
        .eq('id', userId)
      if (rebindError) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to rebind VK profile' })
      }
      userId = syntheticUserId
    } else {
      await serviceClient
        .from('profiles')
        .update({
          vk_user_id: vkUserId,
          vk_email: vkEmail || null,
          vk_phone: vkPhone || null,
        })
        .eq('id', userId)
    }
  }

  const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  const { data: signInData, error: signInError } = await supabaseForAuth.auth.signInWithPassword({
    email: syntheticEmail,
    password: syntheticPassword,
  })
  if (signInError || !signInData?.session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create VK Supabase session' })
  }

  await serviceClient.from('auth_tokens').delete().eq('token', body.token)
  return {
    success: true,
    userId,
    vkUserId,
    bridge_payload: tokenRow.bridge_payload ?? null,
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    expires_in: signInData.session.expires_in,
  }
})
