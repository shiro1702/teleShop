import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeDashboardStatus, type DashboardOrderStatus } from '~/utils/dashboardOrderStatus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

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

type ClientOrderItemPreview = {
  name: string
  quantity: number
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const tenant = event.context?.tenant as { telegramBotToken?: string } | undefined
  const botToken =
    typeof tenant?.telegramBotToken === 'string' && tenant.telegramBotToken.trim()
      ? tenant.telegramBotToken.trim()
      : String(config.botToken || '')

  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: 'Bot token missing' })
  }

  let profileId: string
  try {
    profileId = await resolveCustomerProfileId(event, botToken)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)

  const { data: ordersData, error: ordersError } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,status,fulfillment_type,payment_method,subtotal,delivery_cost,total,items,created_at')
    .eq('customer_profile_id', profileId)
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

  const activeStatuses = new Set<DashboardOrderStatus>(['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery'])
  const items = rows.map((row) => {
    const status = normalizeDashboardStatus(row.status)
    const safeItems = Array.isArray(row.items) ? row.items : []
    const itemsCount = safeItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)
    const itemsPreview: ClientOrderItemPreview[] = safeItems
      .slice(0, 5)
      .map((item) => ({
        name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : 'Позиция',
        quantity: Number(item?.quantity) > 0 ? Number(item.quantity) : 1,
      }))
    const title = restaurantsMap.get(row.restaurant_id || '') || shopsMap.get(row.shop_id) || 'Ресторан'

    return {
      id: row.id,
      shopId: row.shop_id,
      restaurantId: row.restaurant_id,
      restaurantName: title,
      status,
      isActive: activeStatuses.has(status),
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      subtotal: row.subtotal || 0,
      deliveryCost: row.delivery_cost || 0,
      total: row.total || 0,
      itemsCount,
      itemsPreview,
      createdAt: row.created_at,
    }
  })

  return { ok: true, items }
})
