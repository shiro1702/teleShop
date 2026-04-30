import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

export type ServiceCallType = 'call_waiter' | 'call_hookah' | 'request_bill'
export type ServiceCallStatus = 'created' | 'acknowledged' | 'in_progress' | 'resolved' | 'cancelled'
export type ServiceCallChannel = 'telegram' | 'max'

const SERVICE_CALL_LABELS: Record<ServiceCallType, string> = {
  call_waiter: 'Позвать официанта',
  call_hookah: 'Позвать кальянщика',
  request_bill: 'Выставить счет',
}

const STAFF_RESPONSE_TEXTS: Record<string, string> = {
  soon: 'Скоро подойду',
  on_my_way: 'Уже бегу к вам',
  done: 'Запрос выполнен',
}

export function getServiceCallLabel(callType: ServiceCallType): string {
  return SERVICE_CALL_LABELS[callType] || callType
}

export function getStaffResponseText(action: string): string {
  return STAFF_RESPONSE_TEXTS[action] || action
}

export function mapActionToStatus(action: string): ServiceCallStatus {
  if (action === 'done') return 'resolved'
  if (action === 'on_my_way') return 'in_progress'
  return 'acknowledged'
}

export async function sendTelegram(botToken: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`telegram_${method}_failed:${res.status}`)
  }
  return res.json().catch(() => null)
}

export async function sendMax(
  baseUrl: string,
  token: string,
  options: { text: string; conversationId?: string | null; userId?: string | null; attachments?: Array<Record<string, unknown>> },
) {
  const base = baseUrl.replace(/\/$/, '')
  const hasConversation = typeof options.conversationId === 'string' && options.conversationId.trim()
  const hasUser = typeof options.userId === 'string' && options.userId.trim()
  if (!hasConversation && !hasUser) throw new Error('max_target_missing')
  const url = hasConversation
    ? `${base}/messages`
    : `${base}/messages?user_id=${encodeURIComponent(String(options.userId))}`
  const payload = hasConversation
    ? { conversationId: String(options.conversationId), text: options.text }
    : { text: options.text }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      ...(Array.isArray(options.attachments) && options.attachments.length ? { attachments: options.attachments } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`max_send_failed:${res.status}:${text}`)
  }
}

export async function createServiceCallEvent(
  event: H3Event,
  payload: {
    serviceCallId: string
    shopId: string
    restaurantId: string
    orderId?: string | null
    eventType: 'created' | 'status_changed' | 'staff_response' | 'system_note'
    eventStatus?: string | null
    channel: 'system' | 'telegram' | 'max' | 'dashboard'
    actorBindingId?: string | null
    actorExternalUserId?: string | null
    actorDisplayName?: string | null
    message?: string | null
    extraPayload?: Record<string, unknown>
  },
) {
  const client = await serverSupabaseServiceRole(event)
  await client.from('service_call_events').insert({
    service_call_id: payload.serviceCallId,
    shop_id: payload.shopId,
    restaurant_id: payload.restaurantId,
    order_id: payload.orderId || null,
    event_type: payload.eventType,
    event_status: payload.eventStatus || null,
    channel: payload.channel,
    actor_binding_id: payload.actorBindingId || null,
    actor_external_user_id: payload.actorExternalUserId || null,
    actor_display_name: payload.actorDisplayName || null,
    message: payload.message || null,
    payload: payload.extraPayload || {},
  })
}

