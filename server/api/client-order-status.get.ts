import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import {
  parseOrderMetadata,
  normalizeDashboardStatus,
  type TimelineEntry,
} from '~/server/utils/dashboardOrders'
import {
  getMaxBotTokenForShop,
  getMessengerInitDataFromEvent,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
} from '~/server/utils/messengerInitData'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
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
  const tenantKeys = (tenant as { integrationKeys?: Record<string, unknown> } | undefined)?.integrationKeys
  const maxToken = getMaxBotTokenForShop(tenantKeys, {
    maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
    maxApiToken: config.maxApiToken as string | undefined,
  })
  const maxCandidateTokens = uniqueNonEmptyTokens([
    typeof tenantKeys?.max_bot_token === 'string' ? tenantKeys.max_bot_token : undefined,
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

  if (profileId) {
    query = query.eq('customer_profile_id', profileId)
  } else if (telegramUserId != null) {
    query = query.eq('customer_telegram_id', telegramUserId)
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
    query = query.eq('customer_profile_id', maxProfileId)
  }

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

