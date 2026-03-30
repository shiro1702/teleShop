import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  computeDuplicateQtySumByKey,
  computeOrderCountByDuplicateKey,
  normalizeDashboardStatus,
  normalizeOrderItemsJson,
  orderItemDuplicateKey,
  type NormalizedOrderItem,
} from '~/server/utils/dashboardOrders'

type OrderRow = {
  id: string
  status: string
  fulfillment_type: string
  total: number
  created_at: string
  items: unknown
  comment: string | null
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const restaurantId = getRouterParam(event, 'id')
  if (!restaurantId) {
    throw createError({ statusCode: 400, statusMessage: 'Restaurant id is required' })
  }

  const q = getQuery(event)
  const fulfillmentType =
    typeof q.fulfillment_type === 'string' && q.fulfillment_type.trim()
      ? q.fulfillment_type.trim().toLowerCase()
      : 'delivery'

  const client = await serverSupabaseServiceRole(event)

  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .select('id,name')
    .eq('id', restaurantId)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })
  }

  const { data: rows, error } = await client
    .from('orders')
    .select('id,status,fulfillment_type,total,created_at,items,comment')
    .eq('shop_id', access.shopId)
    .eq('restaurant_id', restaurantId)
    .eq('fulfillment_type', fulfillmentType)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('kitchen orders:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load kitchen orders' })
  }

  const allRows = (rows ?? []) as OrderRow[]

  const activeRows = allRows.filter((r) => {
    const st = normalizeDashboardStatus(r.status)
    return st !== 'done' && st !== 'cancelled'
  })

  const normalizedByOrder: NormalizedOrderItem[][] = activeRows.map((r) => normalizeOrderItemsJson(r.items))
  const dupSums = computeDuplicateQtySumByKey(normalizedByOrder)
  const orderCounts = computeOrderCountByDuplicateKey(normalizedByOrder)

  const orders = activeRows.map((row, idx) => {
    const items = normalizedByOrder[idx] ?? []
    const refined = items.map((it) => {
      const key = orderItemDuplicateKey(it)
      const dupQtySum = dupSums.get(key) ?? it.quantity
      const ordersWithKey = orderCounts.get(key) ?? 1
      const isDuplicate = ordersWithKey > 1 || dupQtySum > it.quantity
      return {
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        selectedParameters: it.selectedParameters,
        selectedModifiers: it.selectedModifiers,
        dupQtySum,
        isDuplicate,
      }
    })

    return {
      id: row.id,
      status: normalizeDashboardStatus(row.status),
      fulfillmentType: row.fulfillment_type || 'delivery',
      total: row.total ?? 0,
      createdAt: row.created_at,
      comment: row.comment,
      items: refined,
    }
  })

  return {
    ok: true,
    restaurant: { id: restaurant.id, name: restaurant.name },
    fulfillmentType,
    orders,
  }
})
