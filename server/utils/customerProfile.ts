import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import {
  getMaxBotTokenForShop,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
} from '~/server/utils/messengerInitData'
import { ensureMaxCustomerProfile } from '~/server/utils/ensureMaxCustomerProfile'
import { ensureTelegramCustomerProfile } from '~/server/utils/ensureTelegramCustomerProfile'

export async function resolveCustomerProfileId(event: H3Event, botToken: string | null | undefined): Promise<string> {
  const supabaseUser = await serverSupabaseUser(event)
  if (supabaseUser) {
    const rawUser = supabaseUser as any
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null
    if (userId) return userId
  }

  const initDataMessenger = getHeader(event, 'x-messenger-init-data')?.trim()
  const initDataLegacy = getHeader(event, 'x-telegram-init-data')?.trim()
  const initData = initDataMessenger || initDataLegacy || ''
  if (!initData) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const config = useRuntimeConfig()
  const tenant = event.context?.tenant as {
    telegramBotToken?: string
    integrationKeys?: Record<string, unknown>
  } | undefined
  const integrationKeys = tenant?.integrationKeys ?? {}

  const maxTok = getMaxBotTokenForShop(integrationKeys, {
    maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
    maxApiToken: config.maxApiToken as string | undefined,
  })
  const telegramTokens = uniqueNonEmptyTokens([tenant?.telegramBotToken, botToken, config.botToken as string | undefined])
  const maxTokens = uniqueNonEmptyTokens([
    typeof integrationKeys.max_bot_token === 'string' ? integrationKeys.max_bot_token : undefined,
    config.maxMiniAppBotToken as string | undefined,
    config.maxApiToken as string | undefined,
  ])

  const tgUser = validateWebAppInitDataAnyToken(initData, telegramTokens)
  if (tgUser) {
    const client = await serverSupabaseServiceRole(event)
    const { data: profile } = await client
      .from('profiles')
      .select('id')
      .eq('telegram_id', tgUser.id)
      .maybeSingle()
    if (profile?.id) return String(profile.id)

    const ensured = await ensureTelegramCustomerProfile(event, tgUser.id)
    if (ensured) return ensured

    throw createError({ statusCode: 401, message: 'Profile not found' })
  }

  if (maxTok && maxTokens.length > 0) {
    const maxUser = validateWebAppInitDataAnyToken(initData, maxTokens)
    if (maxUser) {
      const client = await serverSupabaseServiceRole(event)
      const maxId = String(maxUser.id)
      const { data: profile } = await client
        .from('profiles')
        .select('id')
        .eq('max_user_id', maxId)
        .maybeSingle()
      if (profile?.id) return String(profile.id)

      const ensured = await ensureMaxCustomerProfile(event, maxId)
      if (ensured) return ensured
    }
  }

  throw createError({ statusCode: 401, message: 'Invalid initData' })
}
