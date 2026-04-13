import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getCustomerBalance } from '~/server/utils/pricingPromoBonus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  const botToken = typeof shop.telegram_bot_token === 'string' ? shop.telegram_bot_token.trim() : ''

  let customerProfileId: string
  try {
    customerProfileId = await resolveCustomerProfileId(event, botToken)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)
  const balance = await getCustomerBalance(client, shopId, customerProfileId)
  return { ok: true, balance }
})
