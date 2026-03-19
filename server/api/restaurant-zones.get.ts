import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const restaurantId = typeof query.restaurant_id === 'string' ? query.restaurant_id : null
  if (!restaurantId) {
    throw createError({ statusCode: 400, message: 'Missing restaurant_id' })
  }

  const { shopId } = await requireTenantShop(event)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurant_delivery_zones')
    .select('id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
    .eq('shop_id', shopId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to load delivery zones by restaurant:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurant zones' })
  }

  return {
    ok: true,
    shopId,
    restaurantId,
    items: data ?? [],
  }
})
