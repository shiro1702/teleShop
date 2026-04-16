import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { normalizeDashboardStatus } from '~/server/utils/dashboardOrders'

type OrderRow = {
  id: string
  order_number: string | null
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
  external_order_id: string | null
  external_status: string | null
  last_sync_error: string | null
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

  const buildOrdersQuery = (includeOrderNumber: boolean) => {
    const selectFields = includeOrderNumber
      ? `
      id,
      order_number,
      shop_id,
      restaurant_id,
      city_id,
      status,
      fulfillment_type,
      payment_method,
      external_order_id,
      external_status,
      last_sync_error,
      subtotal,
      delivery_cost,
      total,
      items,
      created_at,
      customer_telegram_id,
      customer_profile_id
    `
      : `
      id,
      shop_id,
      restaurant_id,
      city_id,
      status,
      fulfillment_type,
      payment_method,
      external_order_id,
      external_status,
      last_sync_error,
      subtotal,
      delivery_cost,
      total,
      items,
      created_at,
      customer_telegram_id,
      customer_profile_id
    `

    let query = client
      .from('orders')
      .select(selectFields)
      .eq('shop_id', access.shopId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (restaurantId) {
      query = query.eq('restaurant_id', restaurantId)
    }

    if (fulfillmentType) {
      query = query.eq('fulfillment_type', fulfillmentType)
    }

    if (
      statusFilter &&
      ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery', 'handed_to_customer', 'done', 'cancelled'].includes(
        statusFilter,
      )
    ) {
      if (statusFilter === 'handed_to_customer') {
        query = query.in('status', ['handed_to_customer', 'done', 'completed'])
      } else if (statusFilter === 'done') {
        query = query.in('status', ['done', 'completed', 'handed_to_customer'])
      } else {
        query = query.eq('status', statusFilter)
      }
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

    return query
  }

  let { data, error } = await buildOrdersQuery(true)
  // Migration compatibility: if `order_number` is not yet applied, fallback to old select.
  if (error && String((error as any)?.message || '').includes('order_number')) {
    const fallback = await buildOrdersQuery(false)
    data = fallback.data
    error = fallback.error
  }

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
    const itemsPreview = safeItems.map((item: any) => {
      const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : 'Товар'
      const quantity = Number(item?.quantity) > 0 ? Math.floor(Number(item.quantity)) : 1
      return { name, quantity }
    })
    const st = normalizeDashboardStatus(row.status)

    return {
      id: row.id,
      orderNumber: (row as any).order_number || null,
      shopId: row.shop_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_id ? restaurantsMap.get(row.restaurant_id) ?? '—' : '—',
      cityId: row.city_id,
      cityName: row.city_id ? citiesMap.get(row.city_id) ?? '—' : '—',
      brand: shopName,
      status: st,
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      externalOrderId: row.external_order_id || null,
      externalStatus: row.external_status || null,
      lastSyncError: row.last_sync_error || null,
      subtotal: row.subtotal ?? 0,
      deliveryCost: row.delivery_cost ?? 0,
      total: row.total ?? 0,
      itemsCount,
      itemsPreview,
      createdAt: row.created_at,
      customerTelegramId: row.customer_telegram_id,
      customerProfileId: row.customer_profile_id,
    }
  })

  return { ok: true, items }
})
