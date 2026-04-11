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
    .eq('channel', 'max')
    .maybeSingle()
  if (tokenError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check MAX token' })
  }
  if (!tokenRow) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid MAX token' })
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await serviceClient.from('auth_tokens').delete().eq('token', body.token)
    throw createError({ statusCode: 400, statusMessage: 'Token expired' })
  }

  const maxUserId = String(tokenRow.max_user_id || '').trim()
  if (!maxUserId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'MAX confirmation pending',
    })
  }
  const maxConversationId = String(tokenRow.max_conversation_id || '').trim() || null

  const { data: existingProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('max_user_id', maxUserId)
    .maybeSingle()
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to prepare MAX profile' })
  }

  const syntheticEmail = `max_${maxUserId.replace(/[^a-zA-Z0-9._-]/g, '_')}@max.local`
  const secret = (config.sessionSecret as string) || 'max-session-secret'
  const syntheticPassword = crypto.createHash('sha256').update(`${maxUserId}:${secret}`).digest('hex')

  let userId: string
  if (!existingProfile) {
    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { max_user_id: maxUserId },
    })
    if (createUserError || !createdUser?.user) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create MAX user' })
    }
    userId = createdUser.user.id
    const { error: upsertError } = await serviceClient.from('profiles').upsert(
      {
        id: userId,
        max_user_id: maxUserId,
        max_conversation_id: maxConversationId,
      },
      { onConflict: 'id' },
    )
    if (upsertError) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to link MAX profile' })
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
        throw createError({ statusCode: 500, statusMessage: 'Failed to prepare existing MAX user' })
      }
      const syntheticUserId = await findAuthUserIdByEmail(serviceClient, syntheticEmail)
      if (!syntheticUserId) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to repair MAX user mapping' })
      }
      const { error: normalizeError } = await serviceClient.auth.admin.updateUserById(syntheticUserId, {
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { max_user_id: maxUserId },
      })
      if (normalizeError) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to normalize synthetic MAX user' })
      }
      const { error: rebindError } = await serviceClient
        .from('profiles')
        .update({
          id: syntheticUserId,
          max_user_id: maxUserId,
          max_conversation_id: maxConversationId,
        })
        .eq('id', userId)
      if (rebindError) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to rebind MAX profile' })
      }
      userId = syntheticUserId
    } else {
      await serviceClient
        .from('profiles')
        .update({ max_user_id: maxUserId, max_conversation_id: maxConversationId })
        .eq('id', userId)
    }
  }

  const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  const { data: signInData, error: signInError } = await supabaseForAuth.auth.signInWithPassword({
    email: syntheticEmail,
    password: syntheticPassword,
  })
  if (signInError || !signInData?.session) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create MAX Supabase session' })
  }

  await serviceClient.from('auth_tokens').delete().eq('token', body.token)
  return {
    success: true,
    userId,
    maxUserId,
    bridge_payload: tokenRow.bridge_payload ?? null,
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    expires_in: signInData.session.expires_in,
  }
})
