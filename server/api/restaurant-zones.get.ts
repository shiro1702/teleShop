import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const restaurantId = typeof query.restaurant_id === 'string' ? query.restaurant_id : null
  const allForShop = typeof query.all === 'string' && query.all === '1'

  const { shopId } = await requireTenantShop(event)

  const client = await serverSupabaseServiceRole(event)

  if (allForShop) {
    let zonesQuery = client
      .from('restaurant_delivery_zones')
      .select('id,name,restaurant_id,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active,priority')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('restaurant_id', { ascending: true })
      .order('delivery_cost', { ascending: true })
      .order('priority', { ascending: false })

    let { data, error } = await zonesQuery

    if (error && /priority|column/i.test(String(error.message))) {
      const fb = await client
        .from('restaurant_delivery_zones')
        .select('id,name,restaurant_id,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('restaurant_id', { ascending: true })
        .order('delivery_cost', { ascending: true })
      data = fb.data
      error = fb.error
    }

    if (error) {
      console.error('Failed to load all delivery zones for shop:', error)
      throw createError({ statusCode: 500, message: 'Failed to load restaurant zones' })
    }

    return {
      ok: true,
      shopId,
      all: true as const,
      items: data ?? [],
    }
  }

  if (!restaurantId) {
    throw createError({ statusCode: 400, message: 'Missing restaurant_id (or use all=1)' })
  }

  const zonesQuery = client
    .from('restaurant_delivery_zones')
    .select('id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active,priority')
    .eq('shop_id', shopId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('delivery_cost', { ascending: true })
    .order('priority', { ascending: false })

  let { data, error } = await zonesQuery

  if (error && /priority|column/i.test(String(error.message))) {
    const fb = await client
      .from('restaurant_delivery_zones')
      .select('id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
      .eq('shop_id', shopId)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('delivery_cost', { ascending: true })
    data = fb.data
    error = fb.error
  }

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
