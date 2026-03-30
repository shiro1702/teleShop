import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { normalizeDashboardStatus } from '~/server/utils/dashboardOrders'

type OrderRow = {
  id: string
  shop_id: string
  restaurant_id: string | null
  city_id: string | null
  status: string
  fulfillment_type: string
  payment_method: string
  subtotal: number
  delivery_cost: number
  total: number
  items: unknown
  created_at: string
  customer_telegram_id: number | null
  customer_profile_id: string | null
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const q = getQuery(event)
  const period = typeof q.period === 'string' ? q.period : 'all'
  const statusFilter = typeof q.status === 'string' && q.status !== 'all' ? q.status.toLowerCase() : null
  const restaurantId = typeof q.restaurant_id === 'string' && q.restaurant_id.trim() ? q.restaurant_id.trim() : null
  const fulfillmentType =
    typeof q.fulfillment_type === 'string' && q.fulfillment_type.trim() ? q.fulfillment_type.trim().toLowerCase() : null

  const client = await serverSupabaseServiceRole(event)

  let query = client
    .from('orders')
    .select(
      `
      id,
      shop_id,
      restaurant_id,
      city_id,
      status,
      fulfillment_type,
      payment_method,
      subtotal,
      delivery_cost,
      total,
      items,
      created_at,
      customer_telegram_id,
      customer_profile_id
    `,
    )
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }

  if (fulfillmentType) {
    query = query.eq('fulfillment_type', fulfillmentType)
  }

  if (statusFilter && ['new', 'in_progress', 'done', 'cancelled'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const now = new Date()
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    query = query.gte('created_at', start.toISOString())
  } else if (period === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    query = query.gte('created_at', start.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('dashboard orders list:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load orders' })
  }

  const rows = (data ?? []) as OrderRow[]

  const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id).filter((x): x is string => !!x)))
  const cityIds = Array.from(new Set(rows.map((r) => r.city_id).filter((x): x is string => !!x)))

  const restaurantsMap = new Map<string, string>()
  if (restaurantIds.length) {
    const { data: rdata } = await client.from('restaurants').select('id,name').in('id', restaurantIds).eq('shop_id', access.shopId)
    for (const r of rdata ?? []) {
      if (r?.id && r?.name) restaurantsMap.set(r.id as string, r.name as string)
    }
  }

  const citiesMap = new Map<string, string>()
  if (cityIds.length) {
    const { data: cdata } = await client.from('cities').select('id,name').in('id', cityIds)
    for (const c of cdata ?? []) {
      if (c?.id && c?.name) citiesMap.set(c.id as string, c.name as string)
    }
  }

  let shopName = '—'
  const { data: shopRow } = await client.from('shops').select('name').eq('id', access.shopId).maybeSingle()
  if (shopRow?.name) shopName = shopRow.name as string

  const items = rows.map((row) => {
    const safeItems = Array.isArray(row.items) ? row.items : []
    const itemsCount = safeItems.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0)
    const st = normalizeDashboardStatus(row.status)

    return {
      id: row.id,
      shopId: row.shop_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_id ? restaurantsMap.get(row.restaurant_id) ?? '—' : '—',
      cityId: row.city_id,
      cityName: row.city_id ? citiesMap.get(row.city_id) ?? '—' : '—',
      brand: shopName,
      status: st,
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      subtotal: row.subtotal ?? 0,
      deliveryCost: row.delivery_cost ?? 0,
      total: row.total ?? 0,
      itemsCount,
      createdAt: row.created_at,
      customerTelegramId: row.customer_telegram_id,
      customerProfileId: row.customer_profile_id,
    }
  })

  return { ok: true, items }
})
