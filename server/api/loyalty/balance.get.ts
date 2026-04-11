import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getCustomerBalance } from '~/server/utils/pricingPromoBonus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  if (!shop.telegram_bot_token) {
    throw createError({ statusCode: 500, statusMessage: 'Shop bot token missing' })
  }

  let customerProfileId: string
  try {
    customerProfileId = await resolveCustomerProfileId(event, shop.telegram_bot_token)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)
  const balance = await getCustomerBalance(client, shopId, customerProfileId)
  return { ok: true, balance }
})
