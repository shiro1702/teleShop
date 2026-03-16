import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

interface ExchangeSessionBody {
  token?: string
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

    const { data: existingUser, error: getUserError } =
      await serviceClient.auth.admin.getUserById(userId)

    if (getUserError) {
      console.error('Error fetching auth user for existing profile in exchange-session:', getUserError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to prepare existing user for Telegram session',
      })
    }

    if (!existingUser) {
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
        console.error('Error updating existing auth user in exchange-session:', updateError)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to prepare existing Telegram user',
        })
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
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  }
})

