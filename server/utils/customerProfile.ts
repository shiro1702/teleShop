import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getMaxBotTokenForShop, validateWebAppInitData } from '~/server/utils/messengerInitData'

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

  const tgUser = validateWebAppInitData(initData, botToken)
  if (tgUser) {
    const client = await serverSupabaseServiceRole(event)
    const { data: profile } = await client
      .from('profiles')
      .select('id')
      .eq('telegram_id', tgUser.id)
      .maybeSingle()
    if (profile?.id) return String(profile.id)
    throw createError({ statusCode: 401, message: 'Profile not found' })
  }

  if (maxTok) {
    const maxUser = validateWebAppInitData(initData, maxTok)
    if (maxUser) {
      const client = await serverSupabaseServiceRole(event)
      const { data: profile } = await client
        .from('profiles')
        .select('id')
        .eq('max_user_id', String(maxUser.id))
        .maybeSingle()
      if (profile?.id) return String(profile.id)
    }
  }

  throw createError({ statusCode: 401, message: 'Invalid initData' })
}
