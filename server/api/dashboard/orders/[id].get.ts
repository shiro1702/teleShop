import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { normalizeDashboardStatus, normalizeOrderItemsJson, parseOrderMetadata } from '~/server/utils/dashboardOrders'

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
  address: unknown
  pickup_point: unknown
  comment: string | null
  metadata: unknown
  created_at: string
  updated_at: string
  customer_telegram_id: number | null
  customer_profile_id: string | null
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Order id is required' })
  }

  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
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
      address,
      pickup_point,
      comment,
      metadata,
      created_at,
      updated_at,
      customer_telegram_id,
      customer_profile_id
    `,
    )
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (error) {
    console.error('dashboard order detail:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order' })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const row = data as OrderRow
  const { timeline } = parseOrderMetadata(row.metadata)
  const normalizedItems = normalizeOrderItemsJson(row.items)
  const st = normalizeDashboardStatus(row.status)

  let restaurantName = '—'
  if (row.restaurant_id) {
    const { data: r } = await client
      .from('restaurants')
      .select('name')
      .eq('id', row.restaurant_id)
      .eq('shop_id', access.shopId)
      .maybeSingle()
    if (r?.name) restaurantName = r.name as string
  }

  let cityName = '—'
  if (row.city_id) {
    const { data: c } = await client.from('cities').select('name').eq('id', row.city_id).maybeSingle()
    if (c?.name) cityName = c.name as string
  }

  let shopName = '—'
  const { data: shopRow } = await client.from('shops').select('name').eq('id', access.shopId).maybeSingle()
  if (shopRow?.name) shopName = shopRow.name as string

  return {
    ok: true,
    order: {
      id: row.id,
      shopId: row.shop_id,
      restaurantId: row.restaurant_id,
      restaurantName,
      cityId: row.city_id,
      cityName,
      brand: shopName,
      status: st,
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      subtotal: row.subtotal ?? 0,
      deliveryCost: row.delivery_cost ?? 0,
      total: row.total ?? 0,
      items: normalizedItems,
      address: row.address,
      pickupPoint: row.pickup_point,
      comment: row.comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerTelegramId: row.customer_telegram_id,
      customerProfileId: row.customer_profile_id,
      timeline: [...timeline].sort((a, b) => b.at.localeCompare(a.at)),
    },
  }
})
