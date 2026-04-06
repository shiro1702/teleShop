import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { fetchShopLoyaltySettings } from '~/server/utils/pricingPromoBonus'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const settings = await fetchShopLoyaltySettings(client, access.shopId)
  return { ok: true, settings }
})
