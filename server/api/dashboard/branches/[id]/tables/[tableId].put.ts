import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  tableNumber?: string
  isActive?: boolean
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can manage tables' })
  }
  const branchId = getRouterParam(event, 'id')
  const tableId = getRouterParam(event, 'tableId')
  if (!branchId || !tableId) {
    throw createError({ statusCode: 400, statusMessage: 'Branch and table ids are required' })
  }

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.tableNumber === 'string') {
    const normalized = body.tableNumber.trim().slice(0, 64)
    if (!normalized) throw createError({ statusCode: 400, statusMessage: 'tableNumber cannot be empty' })
    patch.table_number = normalized
  }
  if (typeof body.isActive === 'boolean') patch.is_active = body.isActive

  if (Object.keys(patch).length === 1) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurant_tables')
    .update(patch)
    .eq('id', tableId)
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', branchId)
    .select('id,table_number,qr_slug,is_active,created_at,updated_at')
    .maybeSingle()

  if (error || !data) {
    throw createError({ statusCode: 400, statusMessage: error?.message || 'Failed to update table' })
  }

  return {
    ok: true,
    item: {
      id: String(data.id),
      tableNumber: String(data.table_number),
      qrSlug: String(data.qr_slug),
      isActive: data.is_active === true,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    },
  }
})
