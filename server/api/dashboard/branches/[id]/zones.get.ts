import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const branchId = getRouterParam(event, 'id')
  if (!branchId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const zonesQuery = client
    .from('restaurant_delivery_zones')
    .select('id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active,priority')
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', branchId.trim())
    .order('delivery_cost', { ascending: true })
    .order('priority', { ascending: false })

  let { data, error } = await zonesQuery

  if (error && /priority|column/i.test(String(error.message))) {
    const fb = await client
      .from('restaurant_delivery_zones')
      .select('id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
      .eq('shop_id', access.shopId)
      .eq('restaurant_id', branchId.trim())
      .order('delivery_cost', { ascending: true })
    data = fb.data
    error = fb.error
  }

  if (error) {
    console.error('dashboard zones list:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load zones' })
  }

  return {
    ok: true as const,
    items: (data ?? []).map((row: any) => ({
      ...row,
      priority: typeof row.priority === 'number' ? row.priority : 0,
    })),
  }
})
