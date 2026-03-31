import crypto from 'node:crypto'
import { createError, defineEventHandler, getHeader, getQuery } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import {
  parseOrderMetadata,
  normalizeDashboardStatus,
  type TimelineEntry,
} from '~/server/utils/dashboardOrders'

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== hash) return null

  const userStr = params.get('user')
  if (!userStr) return null
  try {
    return JSON.parse(decodeURIComponent(userStr)) as TelegramUser
  } catch {
    return null
  }
}

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

  // Try Telegram auth
  const initDataHeader = getHeader(event, 'x-telegram-init-data')
  let telegramUserId: number | null = null
  if (typeof initDataHeader === 'string' && initDataHeader.trim()) {
      const botToken = tenant?.telegramBotToken || (config.botToken as string | undefined)
    if (typeof botToken === 'string' && botToken.trim()) {
      const tgUser = validateInitData(initDataHeader, botToken)
      telegramUserId = tgUser?.id ?? null
    }
  }

  if (!profileUserId && !telegramUserId) {
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

