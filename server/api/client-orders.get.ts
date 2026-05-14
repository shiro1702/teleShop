import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeDashboardStatus, type DashboardOrderStatus } from '~/utils/dashboardOrderStatus'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'
import {
  getMaxBotTokenForShop,
  getMessengerInitDataFromEvent,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
} from '~/server/utils/messengerInitData'

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

  const profileId = await resolveCustomerProfileId(event, botToken).catch(() => '')
  const initData = getMessengerInitDataFromEvent(event)
  const telegramCandidateTokens = uniqueNonEmptyTokens([
    typeof tenant?.telegramBotToken === 'string' ? tenant.telegramBotToken : undefined,
    botToken,
    config.botToken as string | undefined,
  ])
  const telegramUserId = initData
    ? validateWebAppInitDataAnyToken(initData, telegramCandidateTokens)?.id ?? null
    : null
  const tenantIntegrationKeys = (event.context?.tenant as { integrationKeys?: Record<string, unknown> } | undefined)?.integrationKeys
  const maxToken = getMaxBotTokenForShop(tenantIntegrationKeys, {
    maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
    maxApiToken: config.maxApiToken as string | undefined,
  })
  const maxCandidateTokens = uniqueNonEmptyTokens([
    typeof tenantIntegrationKeys?.max_bot_token === 'string' ? tenantIntegrationKeys.max_bot_token : undefined,
    config.maxMiniAppBotToken as string | undefined,
    config.maxApiToken as string | undefined,
    maxToken,
  ])
  const maxUserId = initData
    ? String(validateWebAppInitDataAnyToken(initData, maxCandidateTokens)?.id || '').trim()
    : ''
  const hasMessengerIdentity = telegramUserId != null || !!maxUserId
  if (!profileId && !hasMessengerIdentity) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)

  let ordersQuery = client
    .from('orders')
    .select('id,shop_id,restaurant_id,status,fulfillment_type,payment_method,subtotal,delivery_cost,total,items,created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (profileId) {
    ordersQuery = ordersQuery.eq('customer_profile_id', profileId)
  } else if (telegramUserId != null) {
    ordersQuery = ordersQuery.eq('customer_telegram_id', telegramUserId)
  } else if (maxUserId) {
    const { data: maxProfile } = await client
      .from('profiles')
      .select('id')
      .eq('max_user_id', maxUserId)
      .maybeSingle()
    const maxProfileId = maxProfile?.id ? String(maxProfile.id) : ''
    if (!maxProfileId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    ordersQuery = ordersQuery.eq('customer_profile_id', maxProfileId)
  }

  const { data: ordersData, error: ordersError } = await ordersQuery

  if (ordersError) {
    console.error('Failed to load client orders:', ordersError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load orders' })
  }

  const rows = (ordersData ?? []) as OrderRow[]
  const shopIds = Array.from(new Set(rows.map((x) => x.shop_id).filter(Boolean)))
  const restaurantIds = Array.from(new Set(rows.map((x) => x.restaurant_id).filter((x): x is string => !!x)))

  const orderIds = rows.map((r) => r.id)
  const reviewByOrderId = new Set<string>()
  if (orderIds.length) {
    const { data: revRows } = await client.from('shop_reviews').select('order_id').in('order_id', orderIds)
    for (const rv of revRows ?? []) {
      const oid = typeof (rv as any)?.order_id === 'string' ? String((rv as any).order_id) : ''
      if (oid) reviewByOrderId.add(oid)
    }
  }

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
      hasShopReview: reviewByOrderId.has(row.id),
    }
  })

  return { ok: true, items }
})
