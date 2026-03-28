import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can deactivate branch' })
  }
  const branchId = getRouterParam(event, 'id')
  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })
  }
  const client = await serverSupabaseServiceRole(event)
  const update = await client
    .from('restaurants')
    .update({ is_active: false })
    .eq('id', branchId)
    .eq('shop_id', access.shopId)
    .select('id,is_active')
    .maybeSingle()
  if (update.error || !update.data) {
    throw createError({ statusCode: 400, statusMessage: update.error?.message || 'Failed to deactivate branch' })
  }
  return { ok: true }
})
