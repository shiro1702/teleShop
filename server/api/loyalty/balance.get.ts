import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getCustomerBalance } from '~/server/utils/pricingPromoBonus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'
import {
  getMaxBotTokenForShop,
  getMessengerInitDataFromEvent,
  validateWebAppInitData,
} from '~/server/utils/messengerInitData'

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  const botToken = typeof shop.telegram_bot_token === 'string' ? shop.telegram_bot_token.trim() : ''

  let customerProfileId: string
  try {
    customerProfileId = await resolveCustomerProfileId(event, botToken)
  } catch (error: any) {
    // Mini app user can be valid by initData but still not linked to profiles.id yet.
    // For bonuses page return zero balance instead of hard 401.
    const initData = getMessengerInitDataFromEvent(event)
    const config = useRuntimeConfig(event)
    const integrationKeys =
      shop.integration_keys && typeof shop.integration_keys === 'object'
        ? (shop.integration_keys as Record<string, unknown>)
        : {}
    const maxBotToken = getMaxBotTokenForShop(integrationKeys, {
      maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
      maxApiToken: config.maxApiToken as string | undefined,
    })
    const isValidMessengerUser =
      !!validateWebAppInitData(initData, botToken) || !!validateWebAppInitData(initData, maxBotToken)
    if (isValidMessengerUser) {
      return { ok: true, balance: 0 }
    }
    if (error?.statusCode === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    throw error
  }

  const client = await serverSupabaseServiceRole(event)
  const balance = await getCustomerBalance(client, shopId, customerProfileId)
  return { ok: true, balance }
})
