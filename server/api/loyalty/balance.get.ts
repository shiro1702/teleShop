import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getCustomerBalance } from '~/server/utils/pricingPromoBonus'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const raw = supabaseUser as any
  const userId =
    typeof raw.id === 'string' ? raw.id : typeof raw.sub === 'string' ? raw.sub : null
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)
  const balance = await getCustomerBalance(client, shopId, userId)
  return { ok: true, balance }
})
