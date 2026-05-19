import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import {
  getMaxBotTokenForShop,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
  type WebAppInitUser,
} from '~/server/utils/messengerInitData'
import { ensureMaxCustomerProfile } from '~/server/utils/ensureMaxCustomerProfile'
import { ensureTelegramCustomerProfile } from '~/server/utils/ensureTelegramCustomerProfile'
import { extractBotIdFromInitData, getShopByBotId } from '~/server/utils/tenant'

function readInitDataFromEvent(event: H3Event): string {
  const initDataMessenger = getHeader(event, 'x-messenger-init-data')?.trim()
  const initDataLegacy = getHeader(event, 'x-telegram-init-data')?.trim()
  return initDataMessenger || initDataLegacy || ''
}

async function collectTelegramValidationTokens(
  event: H3Event,
  initData: string,
  botToken: string | null | undefined,
): Promise<string[]> {
  const config = useRuntimeConfig()
  const tenant = event.context?.tenant as { telegramBotToken?: string } | undefined
  const tokens = uniqueNonEmptyTokens([
    tenant?.telegramBotToken,
    botToken,
    config.botToken as string | undefined,
  ])

  const botId = extractBotIdFromInitData(initData)
  if (botId) {
    const shopByBot = await getShopByBotId(event, botId).catch(() => null)
    if (shopByBot?.telegram_bot_token) {
      return uniqueNonEmptyTokens([...tokens, shopByBot.telegram_bot_token])
    }
  }
  return tokens
}

async function resolveTelegramProfileId(event: H3Event, tgUser: WebAppInitUser): Promise<string> {
  const client = await serverSupabaseServiceRole(event)
  const { data: profileRows } = await client
    .from('profiles')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .limit(1)

  const profile = Array.isArray(profileRows) ? profileRows[0] : null
  if (profile?.id) return String(profile.id)

  const ensured = await ensureTelegramCustomerProfile(event, tgUser.id)
  if (ensured) return ensured

  throw createError({ statusCode: 401, message: 'Profile not found' })
}

async function resolveMaxProfileId(event: H3Event, maxUser: WebAppInitUser): Promise<string> {
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

  throw createError({ statusCode: 401, message: 'Profile not found' })
}

async function resolveProfileFromMessengerInitData(
  event: H3Event,
  initData: string,
  botToken: string | null | undefined,
): Promise<string | null> {
  const config = useRuntimeConfig()
  const tenant = event.context?.tenant as {
    telegramBotToken?: string
    integrationKeys?: Record<string, unknown>
  } | undefined
  const integrationKeys = tenant?.integrationKeys ?? {}

  const telegramTokens = await collectTelegramValidationTokens(event, initData, botToken)
  const tgUser = validateWebAppInitDataAnyToken(initData, telegramTokens)
  if (tgUser) {
    return resolveTelegramProfileId(event, tgUser)
  }

  const maxTok = getMaxBotTokenForShop(integrationKeys, {
    maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
    maxApiToken: config.maxApiToken as string | undefined,
  })
  const maxTokens = uniqueNonEmptyTokens([
    typeof integrationKeys.max_bot_token === 'string' ? integrationKeys.max_bot_token : undefined,
    config.maxMiniAppBotToken as string | undefined,
    config.maxApiToken as string | undefined,
  ])

  if (maxTok && maxTokens.length > 0) {
    const maxUser = validateWebAppInitDataAnyToken(initData, maxTokens)
    if (maxUser) {
      return resolveMaxProfileId(event, maxUser)
    }
  }

  return null
}

/**
 * Профиль покупателя для API адресов/бонусов.
 * В mini app при наличии initData идентификатор берётся из мессенджера, а не из случайной web-сессии.
 */
export async function resolveCustomerProfileId(event: H3Event, botToken: string | null | undefined): Promise<string> {
  const initData = readInitDataFromEvent(event)

  if (initData) {
    const fromMessenger = await resolveProfileFromMessengerInitData(event, initData, botToken)
    if (fromMessenger) return fromMessenger
    throw createError({ statusCode: 401, message: 'Invalid initData' })
  }

  const supabaseUser = await serverSupabaseUser(event)
  if (supabaseUser) {
    const rawUser = supabaseUser as { id?: string; sub?: string }
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null
    if (userId) return userId
  }

  throw createError({ statusCode: 401, message: 'Unauthorized' })
}
