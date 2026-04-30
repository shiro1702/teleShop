import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const branchId = getRouterParam(event, 'id')
  if (!branchId) throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurant_tables')
    .select('id,table_number,qr_slug,is_active,created_at,updated_at')
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', branchId)
    .order('table_number', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to load tables' })
  }

  return {
    ok: true,
    items: (data || []).map((row: any) => ({
      id: String(row.id),
      tableNumber: String(row.table_number),
      qrSlug: String(row.qr_slug),
      isActive: row.is_active === true,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
  }
})
