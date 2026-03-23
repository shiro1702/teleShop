import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

type OrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'

type OrderRow = {
  id: string
  shop_id: string
  restaurant_id: string | null
  status: string
  fulfillment_type: string
  payment_method: string
  subtotal: number
  delivery_cost: number
  total: number
  items: Array<{ name?: string; quantity?: number }>
  created_at: string
}

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const rawUser = supabaseUser as any
  const userId = typeof rawUser.id === 'string'
    ? rawUser.id
    : typeof rawUser.sub === 'string'
      ? rawUser.sub
      : null

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)

  const { data: ordersData, error: ordersError } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,status,fulfillment_type,payment_method,subtotal,delivery_cost,total,items,created_at')
    .eq('customer_profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (ordersError) {
    console.error('Failed to load client orders:', ordersError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load orders' })
  }

  const rows = (ordersData ?? []) as OrderRow[]
  const shopIds = Array.from(new Set(rows.map((x) => x.shop_id).filter(Boolean)))
  const restaurantIds = Array.from(new Set(rows.map((x) => x.restaurant_id).filter((x): x is string => !!x)))

  const shopsMap = new Map<string, string>()
  if (shopIds.length) {
    const { data: shopsData } = await client
      .from('shops')
      .select('id,name')
      .in('id', shopIds)

    for (const row of shopsData ?? []) {
      if (row?.id && row?.name) shopsMap.set(row.id, row.name)
    }
  }

  const restaurantsMap = new Map<string, string>()
  if (restaurantIds.length) {
    const { data: restaurantsData } = await client
      .from('restaurants')
      .select('id,name')
      .in('id', restaurantIds)

    for (const row of restaurantsData ?? []) {
      if (row?.id && row?.name) restaurantsMap.set(row.id, row.name)
    }
  }

  const activeStatuses = new Set<OrderStatus>(['new', 'in_progress'])
  const items = rows.map((row) => {
    const status = (row.status || 'new').toLowerCase()
    const safeItems = Array.isArray(row.items) ? row.items : []
    const itemsCount = safeItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)
    const title = restaurantsMap.get(row.restaurant_id || '') || shopsMap.get(row.shop_id) || 'Ресторан'

    return {
      id: row.id,
      shopId: row.shop_id,
      restaurantId: row.restaurant_id,
      restaurantName: title,
      status,
      isActive: activeStatuses.has(status as OrderStatus),
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      subtotal: row.subtotal || 0,
      deliveryCost: row.delivery_cost || 0,
      total: row.total || 0,
      itemsCount,
      createdAt: row.created_at,
    }
  })

  return { ok: true, items }
})
