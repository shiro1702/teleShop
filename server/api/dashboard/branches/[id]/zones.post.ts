import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  name?: string
  polygon_geojson?: unknown
  min_order_amount?: number
  delivery_cost?: number
  free_delivery_threshold?: number
  priority?: number
  is_active?: boolean
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can manage zones' })
  }
  const branchId = getRouterParam(event, 'id')
  if (!branchId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })
  }

  const body = await readBody<Body>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (body?.polygon_geojson == null || typeof body.polygon_geojson !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'polygon_geojson must be a GeoJSON object' })
  }

  const minOrder = Math.max(0, Math.floor(Number(body.min_order_amount) || 0))
  const deliveryCost = Math.max(0, Math.floor(Number(body.delivery_cost) || 0))
  const freeFrom = Math.max(0, Math.floor(Number(body.free_delivery_threshold) || 0))
  const priority = Math.max(0, Math.floor(Number(body.priority) || 0))
  const isActive = body.is_active !== false

  const client = await serverSupabaseServiceRole(event)

  const insertRow: Record<string, unknown> = {
    shop_id: access.shopId,
    restaurant_id: branchId.trim(),
    name,
    polygon_geojson: body.polygon_geojson,
    min_order_amount: minOrder,
    delivery_cost: deliveryCost,
    free_delivery_threshold: freeFrom,
    is_active: isActive,
  }
  insertRow.priority = priority

  let ins = await client.from('restaurant_delivery_zones').insert(insertRow).select('id').single()

  if (ins.error && /priority|column/i.test(String(ins.error.message))) {
    delete insertRow.priority
    ins = await client.from('restaurant_delivery_zones').insert(insertRow).select('id').single()
  }

  if (ins.error || !ins.data?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: ins.error?.message || 'Failed to create zone',
    })
  }

  return { ok: true as const, id: ins.data.id as string }
})
