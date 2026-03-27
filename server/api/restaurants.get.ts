import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const allowedModes = await applyGlobalFulfillmentPolicy(event, shopId, ['delivery', 'pickup'])
  const allowedSet = new Set(allowedModes)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load restaurants by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants' })
  }

  return {
    ok: true,
    shopId,
    items: (data ?? []).map((item: any) => ({
      ...item,
      supports_delivery: Boolean(item.supports_delivery) && allowedSet.has('delivery'),
      supports_pickup: Boolean(item.supports_pickup) && allowedSet.has('pickup'),
    })),
  }
})
