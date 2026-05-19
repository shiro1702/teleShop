import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { mergeMetadataWithTimeline, type TimelineEntry } from '~/server/utils/dashboardOrders'
import { shouldNotifyCustomerOfStatus } from '~/server/utils/orderChatFlow'
import type { ChatFlowOrderStatus } from './orderChatFlowPure'
import { dispatchNotificationEvent } from '~/server/utils/notifications'

export type UnifiedFlowConfig = {
  unifiedOrderFlowEnabled: true
  etaButtonsEnabled: boolean
  etaPresets: number[]
  etaRateLimitSec: number
}

export async function getUnifiedFlowConfig(event: H3Event, restaurantId: string): Promise<UnifiedFlowConfig> {
  const client = await serverSupabaseServiceRole(event)
  const { data: restaurant } = await client
    .from('restaurants')
    .select('integration_keys')
    .eq('id', restaurantId)
    .maybeSingle()
  const keys = (restaurant as any)?.integration_keys && typeof (restaurant as any).integration_keys === 'object'
    ? ((restaurant as any).integration_keys as Record<string, unknown>)
    : {}
  const rawPresets = Array.isArray((keys as any).eta_presets) ? (keys as any).eta_presets : [10, 15, 20, 30, 45]
  const etaPresets = rawPresets
    .map((value: unknown) => Number(value))
    .filter((value: number) => Number.isFinite(value) && value > 0)
    .map((value: number) => Math.floor(value))
    .slice(0, 8)
  const rateLimitRaw = Number((keys as any).eta_rate_limit_sec ?? 180)
  const etaRateLimitSec = Number.isFinite(rateLimitRaw) ? Math.min(3600, Math.max(30, Math.floor(rateLimitRaw))) : 180
  return {
    unifiedOrderFlowEnabled: true,
    etaButtonsEnabled: Boolean((keys as any).eta_buttons_enabled),
    etaPresets: etaPresets.length ? etaPresets : [10, 15, 20, 30, 45],
    etaRateLimitSec,
  }
}

export async function appendOrderTimelineEntry(event: H3Event, args: {
  orderId: string
  shopId: string
  label: string
  source: 'telegram' | 'max' | 'dashboard'
  userId?: string | null
  comment?: string | null
}): Promise<void> {
  const client = await serverSupabaseServiceRole(event)
  const { data: order } = await client
    .from('orders')
    .select('metadata')
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (!order) return
  const now = new Date().toISOString()
  const entry: TimelineEntry = {
    at: now,
    label: args.label,
    source: args.source,
    userId: args.userId || undefined,
    comment: args.comment ?? null,
  }
  const metadataNext = mergeMetadataWithTimeline((order as any).metadata, entry)
  await client.from('orders').update({ metadata: metadataNext, updated_at: now }).eq('id', args.orderId).eq('shop_id', args.shopId)
}

export async function applyOrderStatusFromChat(event: H3Event, args: {
  orderId: string
  status: ChatFlowOrderStatus
  source: 'telegram' | 'max'
  actorUserId: string
}): Promise<void> {
  const client = await serverSupabaseServiceRole(event)
  const { data: order } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,city_id,order_number,total,status,fulfillment_type,customer_telegram_id,customer_profile_id,metadata')
    .eq('id', args.orderId)
    .maybeSingle()
  if (!order) return
  const now = new Date().toISOString()
  const entry: TimelineEntry = {
    at: now,
    label: `Статус обновлен из чата: ${(order as any).status || 'new'} → ${args.status}`,
    from: String((order as any).status || 'new'),
    to: args.status,
    source: args.source,
    userId: args.actorUserId,
    comment: null,
  }
  const metadataNext = mergeMetadataWithTimeline((order as any).metadata, entry)
  await client
    .from('orders')
    .update({ status: args.status, metadata: metadataNext, updated_at: now })
    .eq('id', args.orderId)
    .eq('shop_id', (order as any).shop_id)

  let customerMaxUserId: string | null = null
  let customerMaxConversationId: string | null = null
  const customerProfileId = (order as any)?.customer_profile_id ? String((order as any).customer_profile_id) : ''
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

  if (shouldNotifyCustomerOfStatus(args.status)) {
    await dispatchNotificationEvent(event, {
      eventId: crypto.randomUUID(),
      eventType: 'ORDER_STATUS_CHANGED',
      occurredAt: now,
      tenantContext: {
        shopId: String((order as any).shop_id),
        restaurantId: String((order as any).restaurant_id || ''),
        cityId: (order as any).city_id ? String((order as any).city_id) : null,
      },
      orderContext: {
        orderId: String((order as any).id),
        orderNumber: String((order as any).order_number || (order as any).id).slice(0, 32),
        totalAmount: Number((order as any).total || 0),
        status: args.status,
        fulfillmentType: String((order as any).fulfillment_type || 'delivery'),
      },
      actorContext: {
        customerTelegramId: (order as any).customer_telegram_id ?? null,
        customerMaxUserId,
        customerMaxConversationId,
      },
    })
  }
}

