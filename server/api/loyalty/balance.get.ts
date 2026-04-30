import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getCustomerBalance } from '~/server/utils/pricingPromoBonus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'
import {
  getMaxBotTokenForShop,
  getMessengerInitDataFromEvent,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
} from '~/server/utils/messengerInitData'

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  const config = useRuntimeConfig(event)
  const botTokenFromShop = typeof shop.telegram_bot_token === 'string' ? shop.telegram_bot_token.trim() : ''
  const botToken =
    botTokenFromShop
    || (typeof config.botToken === 'string' ? config.botToken.trim() : '')

  let customerProfileId = ''
  const supabaseUser = await serverSupabaseUser(event)
  const rawUser = supabaseUser as Record<string, unknown> | null
  const webProfileId =
    typeof rawUser?.id === 'string'
      ? rawUser.id
      : typeof rawUser?.sub === 'string'
        ? rawUser.sub
        : ''
  if (webProfileId) {
    customerProfileId = webProfileId
  } else {
    try {
      customerProfileId = await resolveCustomerProfileId(event, botToken)
    } catch (error: any) {
      // Mini app user can be valid by initData but still not linked to profiles.id yet.
      // For bonuses page return zero balance instead of hard 401.
      const initData = getMessengerInitDataFromEvent(event)
      const integrationKeys =
        shop.integration_keys && typeof shop.integration_keys === 'object'
          ? (shop.integration_keys as Record<string, unknown>)
          : {}
      const maxBotToken = getMaxBotTokenForShop(integrationKeys, {
        maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
        maxApiToken: config.maxApiToken as string | undefined,
      })
      const telegramCandidateTokens = uniqueNonEmptyTokens([
        botTokenFromShop,
        botToken,
        config.botToken as string | undefined,
      ])
      const maxCandidateTokens = uniqueNonEmptyTokens([
        typeof integrationKeys.max_bot_token === 'string' ? integrationKeys.max_bot_token : undefined,
        config.maxMiniAppBotToken as string | undefined,
        config.maxApiToken as string | undefined,
        maxBotToken,
      ])
      const isValidMessengerUser =
        !!validateWebAppInitDataAnyToken(initData, telegramCandidateTokens)
        || !!validateWebAppInitDataAnyToken(initData, maxCandidateTokens)
      if (isValidMessengerUser) {
        return { ok: true, balance: 0 }
      }
      if (error?.statusCode === 401) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
      }
      throw error
    }
  }

  const client = await serverSupabaseServiceRole(event)
  const balance = await getCustomerBalance(client, shopId, customerProfileId)
  return { ok: true, balance }
})
