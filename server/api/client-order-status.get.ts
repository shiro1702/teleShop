import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import {
  parseOrderMetadata,
  normalizeDashboardStatus,
  type TimelineEntry,
} from '~/server/utils/dashboardOrders'
import {
  getMessengerInitDataFromEvent,
  getMaxBotTokenForShop,
  validateWebAppInitData,
} from '~/server/utils/messengerInitData'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig()
  const q = getQuery(event)
  const orderId = typeof q.orderId === 'string' ? q.orderId.trim() : ''
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  const tenant = event.context?.tenant as any
  const tenantShopId: string | undefined = tenant?.shopId
  if (!tenantShopId) {
    throw createError({ statusCode: 401, statusMessage: 'Tenant shop not resolved' })
  }

  const client = await serverSupabaseServiceRole(event)

  // Try WEB auth
  let profileUserId: string | null = null
  const supabaseUser = await serverSupabaseUser(event)
  if (supabaseUser) {
    const rawUser = supabaseUser as any
    profileUserId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null
  }

  const initData = getMessengerInitDataFromEvent(event)
  let telegramUserId: number | null = null
  let maxProfileId: string | null = null

  if (initData) {
    const botToken = tenant?.telegramBotToken || (config.botToken as string | undefined)
    if (typeof botToken === 'string' && botToken.trim()) {
      const tgUser = validateWebAppInitData(initData, botToken)
      if (tgUser) {
        telegramUserId = tgUser.id
      } else {
        const tenantKeys = (tenant as { integrationKeys?: Record<string, unknown> } | undefined)?.integrationKeys
        const maxTok = getMaxBotTokenForShop(tenantKeys, {
          maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
          maxApiToken: config.maxApiToken as string | undefined,
        })
        if (maxTok) {
          const mx = validateWebAppInitData(initData, maxTok)
          if (mx) {
            const { data: prof } = await client
              .from('profiles')
              .select('id')
              .eq('max_user_id', String(mx.id))
              .maybeSingle()
            if (prof?.id) maxProfileId = String(prof.id)
          }
        }
      }
    }
  }

  if (!profileUserId && telegramUserId == null && !maxProfileId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  let query = client
    .from('orders')
    .select(
      `
      id,
      shop_id,
      restaurant_id,
      status,
      payment_status,
      fulfillment_type,
      payment_method,
      subtotal,
      delivery_cost,
      total,
      created_at,
      metadata
    `,
    )
    .eq('id', orderId)
    .eq('shop_id', tenantShopId)

  if (profileUserId) query = query.eq('customer_profile_id', profileUserId)
  else if (telegramUserId != null) query = query.eq('customer_telegram_id', telegramUserId)
  else if (maxProfileId) query = query.eq('customer_profile_id', maxProfileId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('client-order-status load error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order status' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const row = data as any
  const st = normalizeDashboardStatus(row.status as string)

  let restaurantName = '—'
  if (row.restaurant_id) {
    const { data: r } = await client
      .from('restaurants')
      .select('name')
      .eq('id', row.restaurant_id)
      .eq('shop_id', tenantShopId)
      .maybeSingle()
    if (r?.name) restaurantName = r.name as string
  }

  const { timeline } = parseOrderMetadata(row.metadata)

  return {
    ok: true,
    order: {
      id: row.id as string,
      status: st,
      paymentStatus: row.payment_status || 'unpaid',
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'cash',
      subtotal: row.subtotal ?? 0,
      deliveryCost: row.delivery_cost ?? 0,
      total: row.total ?? 0,
      restaurantId: row.restaurant_id ?? null,
      restaurantName,
      createdAt: row.created_at,
      timeline: timeline as TimelineEntry[],
      metadata: row.metadata ?? {},
    },
  }
})

