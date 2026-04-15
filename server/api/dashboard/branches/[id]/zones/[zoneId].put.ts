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

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableSerialize(v)).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`)
  return `{${entries.join(',')}}`
}

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

  const patch: Record<string, unknown> = {
    name,
    polygon_geojson: body.polygon_geojson,
    min_order_amount: minOrder,
    delivery_cost: deliveryCost,
    free_delivery_threshold: freeFrom,
    is_active: isActive,
  }
  patch.priority = priority

  let upd = await client
    .from('restaurant_delivery_zones')
    .update(patch)
    .eq('id', zoneId.trim())
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', branchId.trim())
    .select('id,polygon_geojson')
    .maybeSingle()

  if (upd.error && /priority|column/i.test(String(upd.error.message))) {
    delete patch.priority
    upd = await client
      .from('restaurant_delivery_zones')
      .update(patch)
      .eq('id', zoneId.trim())
      .eq('shop_id', access.shopId)
      .eq('restaurant_id', branchId.trim())
      .select('id,polygon_geojson')
      .maybeSingle()
  }

  if (upd.error || !upd.data?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: upd.error?.message || 'Failed to update zone',
    })
  }

  const expectedPolygon = stableSerialize(body.polygon_geojson)
  const persistedPolygon = stableSerialize((upd.data as any).polygon_geojson)
  if (expectedPolygon !== persistedPolygon) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Polygon was not persisted correctly',
    })
  }

  return { ok: true as const, id: upd.data.id }
})
