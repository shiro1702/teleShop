import crypto from 'node:crypto'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  mergeMetadataWithTimeline,
  normalizeDashboardStatus,
  getAllowedOrderStatusTransitions,
  type DashboardOrderStatus,
  type TimelineEntry,
} from '~/server/utils/dashboardOrders'
import { dashboardOrderStatusLabels } from '~/utils/dashboardOrderStatus'
import { dispatchNotificationEvent } from '~/server/utils/notifications'
import { accrueLoyaltyEarnForPaidOrder } from '~/server/utils/pricingPromoBonus'

type Body = {
  nextStatus?: string
  comment?: string | null
}

const statusLabels = dashboardOrderStatusLabels

function resolveReviewReminderDelayMs(raw: unknown): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 5 * 60 * 1000
  return Math.max(10_000, parsed)
}

async function sendReviewReminder(args: {
  client: Awaited<ReturnType<typeof serverSupabaseServiceRole>>
  config: ReturnType<typeof useRuntimeConfig>
  orderId: string
  orderNumber: string
  shopId: string
  restaurantId: string | null
  customerTelegramId: number | null
  customerMaxUserId: string | null
  customerMaxConversationId: string | null
}) {
  if (!args.restaurantId) return
  const { data: restaurant } = await args.client
    .from('restaurants')
    .select('festival_id,name')
    .eq('id', args.restaurantId)
    .maybeSingle()
  const festivalId = (restaurant as any)?.festival_id
  if (!festivalId) return

  const { data: festival } = await args.client
    .from('festivals')
    .select('name,slug')
    .eq('id', festivalId)
    .maybeSingle()

  const orderRef = String(args.orderNumber || args.orderId).slice(0, 12)
  const festivalName = String((festival as any)?.name || 'фестиваля')
  const reminderText = [
    `Как вам заказ #${orderRef}?`,
    `Поделитесь коротким видеоотзывом о блюде для ${festivalName} и получите бонусные баллы.`,
    'Откройте миниапп, раздел "Мои заказы" и нажмите "Добавить видеоотзыв".',
  ].join('\n')

  const botToken = String((args.config as any).botToken || '')
  if (args.customerTelegramId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: args.customerTelegramId,
        text: reminderText,
      }),
    }).catch((err) => {
      console.error('festival review reminder telegram send failed:', err)
    })
  }

  const maxBaseUrl = String((args.config as any).maxApiBaseUrl || '').replace(/\/$/, '')
  const maxToken = String((args.config as any).maxApiToken || '')
  const hasMaxConversation = typeof args.customerMaxConversationId === 'string' && args.customerMaxConversationId.trim()
  const hasMaxUserId = typeof args.customerMaxUserId === 'string' && args.customerMaxUserId.trim()
  if ((hasMaxConversation || hasMaxUserId) && maxBaseUrl && maxToken) {
    const url = hasMaxConversation
      ? `${maxBaseUrl}/messages`
      : `${maxBaseUrl}/messages?user_id=${encodeURIComponent(String(args.customerMaxUserId))}`
    const body = hasMaxConversation
      ? { conversationId: String(args.customerMaxConversationId), text: reminderText }
      : { text: reminderText }
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: maxToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch((err) => {
      console.error('festival review reminder max send failed:', err)
    })
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Order id is required' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const nextRaw = typeof body?.nextStatus === 'string' ? body.nextStatus.trim().toLowerCase() : ''
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

  const nextStatus: DashboardOrderStatus | null =
    nextRaw === 'in_progress' || nextRaw === 'in-progress'
      ? 'in_progress'
      : nextRaw === 'ready_for_pickup' || nextRaw === 'ready-for-pickup'
        ? 'ready_for_pickup'
        : nextRaw === 'out_for_delivery' || nextRaw === 'out-for-delivery'
          ? 'out_for_delivery'
          : nextRaw === 'handed_to_customer' || nextRaw === 'handed-to-customer' || nextRaw === 'done'
            ? 'handed_to_customer'
            : nextRaw === 'cancelled' || nextRaw === 'canceled'
              ? 'cancelled'
              : nextRaw === 'new'
                ? 'new'
                : null

  if (!nextStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid nextStatus' })
  }

  if (nextStatus === 'cancelled' && !comment) {
    throw createError({ statusCode: 400, statusMessage: 'Comment is required for cancellation' })
  }

  const client = await serverSupabaseServiceRole(event)

  const { data: existing, error: loadError } = await client
    .from('orders')
    .select('id,order_number,status,metadata,fulfillment_type,total,restaurant_id,city_id,customer_telegram_id,customer_profile_id')
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (loadError) {
    console.error('dashboard order status load:', loadError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order' })
  }

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const current = normalizeDashboardStatus(existing.status as string)
  const allowed = getAllowedOrderStatusTransitions(current, existing.fulfillment_type as string | null)
  if (!allowed.includes(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status transition' })
  }

  const now = new Date().toISOString()
  const entry: TimelineEntry = {
    at: now,
    label: `Статус: ${statusLabels[current]} → ${statusLabels[nextStatus]}${comment ? ` (${comment})` : ''}`,
    from: current,
    to: nextStatus,
    source: 'dashboard',
    userId: access.userId,
    comment: comment || null,
  }

  const newMetadata = mergeMetadataWithTimeline(existing.metadata, entry)

  const { error: updateError } = await client
    .from('orders')
    .update({
      status: nextStatus,
      metadata: newMetadata,
      updated_at: now,
    })
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (updateError) {
    console.error('dashboard order status update:', updateError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update order' })
  }

  if (nextStatus === 'handed_to_customer') {
    await accrueLoyaltyEarnForPaidOrder(client, String((existing as any).id), access.shopId)
  }

  const customerProfileId = (existing as any)?.customer_profile_id ? String((existing as any).customer_profile_id) : ''
  let customerMaxUserId: string | null = null
  let customerMaxConversationId: string | null = null
  if (customerProfileId) {
    const { data: profile } = await client
      .from('profiles')
      .select('max_user_id,max_conversation_id')
      .eq('id', customerProfileId)
      .maybeSingle()
    const rawUserId = (profile as any)?.max_user_id
    const rawConversationId = (profile as any)?.max_conversation_id
    customerMaxUserId = typeof rawUserId === 'string' && rawUserId.trim() ? rawUserId.trim() : null
    customerMaxConversationId = typeof rawConversationId === 'string' && rawConversationId.trim() ? rawConversationId.trim() : null
  }

  await dispatchNotificationEvent(event, {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_STATUS_CHANGED',
    occurredAt: now,
    tenantContext: {
      shopId: access.shopId,
      restaurantId: String((existing as any).restaurant_id || ''),
      cityId: (existing as any).city_id ? String((existing as any).city_id) : null,
    },
    orderContext: {
      orderId: String((existing as any).id),
      orderNumber: String((existing as any).order_number || (existing as any).id).slice(0, 32),
      totalAmount: Number((existing as any).total || 0),
      status: nextStatus,
      fulfillmentType: String((existing as any).fulfillment_type || 'delivery'),
    },
    actorContext: {
      customerTelegramId: (existing as any).customer_telegram_id ?? null,
      customerMaxUserId,
      customerMaxConversationId,
    },
  })

  if (nextStatus === 'handed_to_customer') {
    const reminderDelayMs = resolveReviewReminderDelayMs((config as any).festivalReviewReminderDelayMs)
    const orderId = String((existing as any).id)
    const orderNumber = String((existing as any).order_number || orderId)
    const restaurantId = (existing as any)?.restaurant_id ? String((existing as any).restaurant_id) : null
    const customerTelegramIdRaw = Number((existing as any)?.customer_telegram_id)
    const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0
      ? customerTelegramIdRaw
      : null
    setTimeout(() => {
      void sendReviewReminder({
        client,
        config,
        orderId,
        orderNumber,
        shopId: access.shopId,
        restaurantId,
        customerTelegramId,
        customerMaxUserId,
        customerMaxConversationId,
      })
    }, reminderDelayMs)
  }

  return { ok: true, status: nextStatus }
})
