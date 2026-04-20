import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Address id is required' })
  }

  const { shopId, shop } = await requireTenantShop(event)
  const customerProfileId = await resolveCustomerProfileId(event, shop.telegram_bot_token)
  const client = await serverSupabaseServiceRole(event)

  const { error } = await client
    .from('customer_delivery_addresses')
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId)
    .eq('customer_profile_id', customerProfileId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete address' })
  }

  return { ok: true }
})
