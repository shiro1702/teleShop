import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const query = getQuery(event)
  const restaurantId = typeof query.restaurantId === 'string' ? query.restaurantId.trim() : ''
  if (!restaurantId) throw createError({ statusCode: 400, statusMessage: 'restaurantId is required' })

  const client = await serverSupabaseServiceRole(event)
  const { data: restaurant } = await client
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('shop_id', access.shopId)
    .maybeSingle()
  if (!restaurant) throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: calls } = await client
    .from('service_calls')
    .select('id,call_type,status,created_at,first_response_at,resolved_at')
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', restaurantId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(200)

  const items = (calls || []).map((row: any) => {
    const createdAt = new Date(String(row.created_at)).getTime()
    const firstResponseAt = row.first_response_at ? new Date(String(row.first_response_at)).getTime() : null
    const resolvedAt = row.resolved_at ? new Date(String(row.resolved_at)).getTime() : null
    return {
      id: String(row.id),
      callType: String(row.call_type),
      status: String(row.status),
      createdAt: String(row.created_at),
      firstResponseAt: row.first_response_at ? String(row.first_response_at) : null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      firstResponseSec: firstResponseAt && Number.isFinite(createdAt) ? Math.max(0, Math.round((firstResponseAt - createdAt) / 1000)) : null,
      resolvedSec: resolvedAt && Number.isFinite(createdAt) ? Math.max(0, Math.round((resolvedAt - createdAt) / 1000)) : null,
    }
  })
  const firstResponseValues = items.map((x) => x.firstResponseSec).filter((x): x is number => typeof x === 'number')
  const resolvedValues = items.map((x) => x.resolvedSec).filter((x): x is number => typeof x === 'number')
  const average = (list: number[]) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null)

  return {
    ok: true,
    stats: {
      total: items.length,
      open: items.filter((x) => x.status !== 'resolved' && x.status !== 'cancelled').length,
      avgFirstResponseSec: average(firstResponseValues),
      avgResolvedSec: average(resolvedValues),
    },
    items,
  }
})

