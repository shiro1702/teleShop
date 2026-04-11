import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

interface ExchangeSessionBody {
  token?: string
}

async function findAuthUserIdByEmail(
  serviceClient: any,
  email: string,
): Promise<string | null> {
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('Error listing auth users in exchange-session:', error)
      return null
    }
    const users = data?.users ?? []
    const hit = users.find((user: any) => (user.email || '').toLowerCase() === email.toLowerCase())
    if (hit?.id) return hit.id
    if (users.length < perPage) break
    page += 1
  }
  return null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ExchangeSessionBody>(event)

  if (!body?.token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token is required',
    })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = (config.supabaseUrl as string) || ''
  const supabaseAnonKey = (config.public.supabaseKey as string) || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase URL or anon key missing',
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  // Находим токен и проверяем срок действия
  const { data: tokenRow, error: tokenError } = await serviceClient
    .from('auth_tokens')
    .select('*')
    .eq('token', body.token)
    .maybeSingle()

  if (tokenError) {
    console.error('Error querying auth_tokens in exchange-session:', tokenError)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check token',
    })
  }

  if (!tokenRow) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid token',
    })
  }

  const now = new Date()
  const expiresAt = new Date(tokenRow.expires_at)

  if (expiresAt.getTime() < now.getTime()) {
    await serviceClient.from('auth_tokens').delete().eq('token', body.token)
    throw createError({
      statusCode: 400,
      statusMessage: 'Token expired',
    })
  }

  if (tokenRow.telegram_id == null) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Telegram confirmation pending',
    })
  }

  const telegramId: number = tokenRow.telegram_id

  // Пытаемся найти существующий профиль по telegram_id
  const { data: existingProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (profileError) {
    console.error('Error querying profiles by telegram_id in exchange-session:', profileError)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to prepare session for Telegram',
    })
  }

  // Используем детерминированную "синтетическую" пару email/пароль
  const syntheticEmail = `tg_${telegramId}@telegram.local`
  const secret = (config.sessionSecret as string) || 'telegram-session-secret'
  const syntheticPassword = crypto
    .createHash('sha256')
    .update(String(telegramId) + ':' + secret)
    .digest('hex')

  let userId: string

  if (!existingProfile) {
    // Пользователь и профиль ещё не созданы — создаём с нуля
    const { data: createdUser, error: createUserError } =
      await serviceClient.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
        },
      })

    if (createUserError || !createdUser?.user) {
      console.error('Error creating auth user for telegram_id in exchange-session:', createUserError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create user for Telegram',
      })
    }

    userId = createdUser.user.id

    const { error: upsertError } = await serviceClient
      .from('profiles')
      .upsert(
        {
          id: userId,
          telegram_id: telegramId,
        },
        { onConflict: 'id' },
      )

    if (upsertError) {
      console.error('Error creating profile with telegram_id in exchange-session:', upsertError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to link Telegram profile',
      })
    }
  } else {
    // Профиль уже есть: убеждаемся, что auth-пользователь существует и имеет синтетические учётные данные
    userId = existingProfile.id as string

    const { data: existingUserData, error: getUserError } =
      await serviceClient.auth.admin.getUserById(userId)

    if (getUserError) {
      console.error('Error fetching auth user for existing profile in exchange-session:', getUserError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to prepare existing user for Telegram session',
      })
    }

    const existingAuthUser = existingUserData?.user ?? null

    if (!existingAuthUser) {
      // На всякий случай: профиль есть, а пользователя нет — создаём нового пользователя и переназначаем профиль
      const { data: createdUser, error: createUserError } =
        await serviceClient.auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            telegram_id: telegramId,
          },
        })

      if (createUserError || !createdUser?.user) {
        console.error(
          'Error creating auth user for orphaned profile in exchange-session:',
          createUserError,
        )
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to repair Telegram user',
        })
      }

      userId = createdUser.user.id

      const { error: upsertError } = await serviceClient
        .from('profiles')
        .upsert(
          {
            id: userId,
            telegram_id: telegramId,
          },
          { onConflict: 'id' },
        )

      if (upsertError) {
        console.error(
          'Error updating profile for orphaned user in exchange-session:',
          upsertError,
        )
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to link repaired Telegram profile',
        })
      }
    } else {
      // Приводим существующего пользователя к синтетическому email/паролю (чтобы signInWithPassword всегда работал)
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
      })

      if (updateError) {
        console.warn('Primary updateUserById failed, trying repair path in exchange-session:', updateError)

        // Repair path: synthetic email may belong to another auth user OR current user cannot be normalized directly.
        // Rebind profile to synthetic user and normalize password/metadata.
        let syntheticUserId = await findAuthUserIdByEmail(serviceClient, syntheticEmail)
        if (!syntheticUserId) {
          const { data: createdSyntheticUser, error: createSyntheticError } =
            await serviceClient.auth.admin.createUser({
              email: syntheticEmail,
              password: syntheticPassword,
              email_confirm: true,
              user_metadata: {
                telegram_id: telegramId,
              },
            })
          if (createSyntheticError || !createdSyntheticUser?.user?.id) {
            console.error('Error creating synthetic auth user during repair in exchange-session:', createSyntheticError)
            throw createError({
              statusCode: 500,
              statusMessage: 'Failed to prepare existing Telegram user',
            })
          }
          syntheticUserId = createdSyntheticUser.user.id
        }

        const { error: normalizeSyntheticError } = await serviceClient.auth.admin.updateUserById(syntheticUserId, {
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            telegram_id: telegramId,
          },
        })
        if (normalizeSyntheticError) {
          console.error('Error normalizing synthetic auth user in exchange-session:', normalizeSyntheticError)
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to normalize synthetic Telegram user',
          })
        }

        const { error: rebindError } = await serviceClient
          .from('profiles')
          .update({ id: syntheticUserId, telegram_id: telegramId })
          .eq('id', userId)
          .eq('telegram_id', telegramId)
        if (rebindError) {
          console.error('Error rebinding profile to synthetic user in exchange-session:', rebindError)
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to rebind Telegram profile',
          })
        }
        userId = syntheticUserId
      }
    }
  }

  // Создаём сессию Supabase для этого пользователя через signInWithPassword
  const supabaseForAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  })

  const { data: signInData, error: signInError } =
    await supabaseForAuth.auth.signInWithPassword({
      email: syntheticEmail,
      password: syntheticPassword,
    })

  if (signInError || !signInData?.session) {
    console.error('Error signing in synthetic user for Telegram:', signInError)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create Supabase session',
    })
  }

  const session = signInData.session

  // Токен больше не нужен — удаляем
  const { error: deleteError } = await serviceClient
    .from('auth_tokens')
    .delete()
    .eq('token', body.token)

  if (deleteError) {
    console.error('Error deleting auth_token in exchange-session:', deleteError)
  }

  return {
    success: true,
    userId,
    telegramId,
    bridge_payload: tokenRow.bridge_payload ?? null,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  }
})

