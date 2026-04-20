import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can manage zones' })
  }
  const branchId = getRouterParam(event, 'id')
  const zoneId = getRouterParam(event, 'zoneId')
  if (!branchId?.trim() || !zoneId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Branch id and zone id are required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { error } = await client
    .from('restaurant_delivery_zones')
    .delete()
    .eq('id', zoneId.trim())
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', branchId.trim())

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Failed to delete zone' })
  }

  return { ok: true as const }
})
