import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

export type NotificationEventType = 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED'
export type NotificationChannel = 'telegram' | 'max'
export type NotificationTargetType = 'manager_group' | 'manager_user' | 'customer'

export type NotificationEvent = {
  eventId: string
  eventType: NotificationEventType
  occurredAt: string
  tenantContext: {
    shopId: string
    restaurantId: string
    cityId: string | null
  }
  orderContext: {
    orderId: string
    orderNumber: string
    totalAmount: number
    status: string
  }
  actorContext?: {
    customerTelegramId?: number | null
    customerMaxUserId?: string | null
    customerMaxConversationId?: string | null
  }
}

type Recipient = {
  channel: NotificationChannel
  targetType: NotificationTargetType
  targetId: string
  conversationId: string | null
}

const statusDictionary: Record<string, string> = {
  new: 'Создан',
  in_progress: 'Готовится',
  ready_for_pickup: 'Готов к выдаче',
  out_for_delivery: 'Передан курьеру',
  handed_to_customer: 'Доставлен',
  cancelled: 'Отменен',
}

function getStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase()
  return statusDictionary[normalized] ?? normalized
}

function buildNotificationKey(
  eventType: NotificationEventType,
  orderId: string,
  channel: NotificationChannel,
  targetType: NotificationTargetType,
  targetId: string,
): string {
  return `${eventType}:${orderId}:${channel}:${targetType}:${targetId}`
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })
  if (!response.ok) {
    throw new Error(`telegram_send_failed:${response.status}`)
  }
}

async function sendMaxMessage(baseUrl: string, token: string, conversationId: string, text: string): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      text,
    }),
  })
  if (!response.ok) {
    throw new Error(`max_send_failed:${response.status}`)
  }
}

function buildManagerMessage(payload: {
  orderNumber: string
  brandName: string
  branchName: string
  cityName: string
  customerHandle: string
  totalAmount: number
}): string {
  return [
    `Новый заказ #${payload.orderNumber}`,
    `Ресторан: ${payload.brandName} • ${payload.branchName} • ${payload.cityName}`,
    `Клиент: ${payload.customerHandle}`,
    `Сумма: ${new Intl.NumberFormat('ru-RU').format(payload.totalAmount)} ₽`,
  ].join('\n')
}

function buildCustomerMessage(payload: {
  orderNumber: string
  status: string
  brandName: string
  branchName: string
  cityName: string
}): string {
  return [
    `Статус заказа #${payload.orderNumber}: ${getStatusLabel(payload.status)}`,
    `Ресторан: ${payload.brandName} • ${payload.branchName} • ${payload.cityName}`,
  ].join('\n')
}

async function resolveRecipients(event: H3Event, input: NotificationEvent): Promise<Recipient[]> {
  const client = await serverSupabaseServiceRole(event)
  const { data: restaurant } = await client
    .from('restaurants')
    .select('manager_notification_mode,manager_group_chat_id,manager_max_chat_id,manager_recipients')
    .eq('id', input.tenantContext.restaurantId)
    .maybeSingle()

  const recipients: Recipient[] = []
  const mode = String((restaurant as any)?.manager_notification_mode || 'group')
  const managerRecipients = Array.isArray((restaurant as any)?.manager_recipients)
    ? ((restaurant as any).manager_recipients as Array<Record<string, unknown>>)
    : []

  if (mode === 'group') {
    const tgGroupId = typeof (restaurant as any)?.manager_group_chat_id === 'string'
      ? (restaurant as any).manager_group_chat_id.trim()
      : ''
    const maxGroupId = typeof (restaurant as any)?.manager_max_chat_id === 'string'
      ? (restaurant as any).manager_max_chat_id.trim()
      : ''
    if (tgGroupId) {
      recipients.push({ channel: 'telegram', targetType: 'manager_group', targetId: tgGroupId, conversationId: tgGroupId })
    }
    if (maxGroupId) {
      recipients.push({ channel: 'max', targetType: 'manager_group', targetId: maxGroupId, conversationId: maxGroupId })
    }
  } else {
    for (const manager of managerRecipients) {
      const channel = manager.channel === 'max' ? 'max' : manager.channel === 'telegram' ? 'telegram' : null
      const targetId = typeof manager.targetId === 'string' ? manager.targetId.trim() : ''
      if (!channel || !targetId) continue
      recipients.push({ channel, targetType: 'manager_user', targetId, conversationId: targetId })
    }
  }

  if (input.actorContext?.customerTelegramId) {
    const chatId = String(input.actorContext.customerTelegramId)
    recipients.push({ channel: 'telegram', targetType: 'customer', targetId: chatId, conversationId: chatId })
  }
  if (input.actorContext?.customerMaxConversationId) {
    recipients.push({
      channel: 'max',
      targetType: 'customer',
      targetId: input.actorContext.customerMaxConversationId,
      conversationId: input.actorContext.customerMaxConversationId,
    })
  }
  return recipients
}

async function upsertNotificationEvent(
  event: H3Event,
  payload: {
    key: string
    input: NotificationEvent
    channel: NotificationChannel
    conversationId: string | null
    status: 'pending' | 'sent' | 'failed' | 'retrying'
    lastError?: string | null
  },
): Promise<void> {
  const client = await serverSupabaseServiceRole(event)
  const { data: existing } = await client
    .from('notification_events')
    .select('id,attempt_count')
    .eq('notification_key', payload.key)
    .maybeSingle()

  const attemptCount = ((existing as any)?.attempt_count ?? 0) + 1
  const body = {
    notification_key: payload.key,
    event_type: payload.input.eventType,
    channel: payload.channel,
    shop_id: payload.input.tenantContext.shopId,
    restaurant_id: payload.input.tenantContext.restaurantId,
    city_id: payload.input.tenantContext.cityId,
    conversation_id: payload.conversationId,
    delivery_status: payload.status,
    attempt_count: attemptCount,
    last_error: payload.lastError ?? null,
    payload: payload.input,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await client.from('notification_events').update(body).eq('id', (existing as any).id)
    return
  }
  await client.from('notification_events').insert(body)
}

export async function dispatchNotificationEvent(event: H3Event, input: NotificationEvent): Promise<void> {
  const config = useRuntimeConfig(event)
  const client = await serverSupabaseServiceRole(event)
  const recipients = await resolveRecipients(event, input)

  const { data: shopRow } = await client
    .from('shops')
    .select('name,telegram_bot_token,manager_chat_id,channel_policy')
    .eq('id', input.tenantContext.shopId)
    .maybeSingle()
  const { data: branchRow } = await client
    .from('restaurants')
    .select('name,manager_group_chat_id')
    .eq('id', input.tenantContext.restaurantId)
    .maybeSingle()
  const { data: cityRow } = input.tenantContext.cityId
    ? await client.from('cities').select('name').eq('id', input.tenantContext.cityId).maybeSingle()
    : { data: null as any }

  const brandName = String((shopRow as any)?.name || '—')
  const branchName = String((branchRow as any)?.name || '—')
  const cityName = String((cityRow as any)?.name || '—')
  const customerHandle = input.actorContext?.customerTelegramId ? `id:${input.actorContext.customerTelegramId}` : 'id:unknown'
  const managerText = buildManagerMessage({
    orderNumber: input.orderContext.orderNumber,
    brandName,
    branchName,
    cityName,
    customerHandle,
    totalAmount: input.orderContext.totalAmount,
  })
  const customerText = buildCustomerMessage({
    orderNumber: input.orderContext.orderNumber,
    status: input.orderContext.status,
    brandName,
    branchName,
    cityName,
  })

  const maxBaseUrl = String((config as any).maxApiBaseUrl || '')
  const maxToken = String((config as any).maxApiToken || '')
  const maxBackoffMs = [30_000, 120_000, 600_000]
  const maxEnabledByRuntime = Boolean(maxBaseUrl && maxToken)
  const maxEnabledByPolicy = Boolean((shopRow as any)?.channel_policy?.maxEnabled)
  const defaultManagerTelegramChatId =
    typeof (branchRow as any)?.manager_group_chat_id === 'string' && (branchRow as any).manager_group_chat_id.trim()
      ? String((branchRow as any).manager_group_chat_id).trim()
      : typeof (shopRow as any)?.manager_chat_id === 'string'
        ? String((shopRow as any).manager_chat_id).trim()
        : ''

  for (const recipient of recipients) {
    const key = buildNotificationKey(input.eventType, input.orderContext.orderId, recipient.channel, recipient.targetType, recipient.targetId)
    const isManagerTarget = recipient.targetType === 'manager_group' || recipient.targetType === 'manager_user'
    const text = isManagerTarget && input.eventType === 'ORDER_CREATED' ? managerText : customerText

    await upsertNotificationEvent(event, {
      key,
      input,
      channel: recipient.channel,
      conversationId: recipient.conversationId,
      status: 'pending',
    })

    try {
      if (recipient.channel === 'telegram') {
        const botToken = String((shopRow as any)?.telegram_bot_token || (config.botToken as string))
        await sendTelegramMessage(botToken, recipient.targetId, text)
      } else {
        if (!maxEnabledByRuntime || !maxEnabledByPolicy) {
          throw new Error('max_channel_disabled')
        }
        let sent = false
        let lastError: string | null = null
        for (let attempt = 0; attempt < maxBackoffMs.length; attempt += 1) {
          try {
            await sendMaxMessage(maxBaseUrl, maxToken, recipient.targetId, text)
            sent = true
            break
          } catch (err: any) {
            lastError = err?.message || 'max_send_failed'
            await upsertNotificationEvent(event, {
              key,
              input,
              channel: recipient.channel,
              conversationId: recipient.conversationId,
              status: attempt === maxBackoffMs.length - 1 ? 'failed' : 'retrying',
              lastError,
            })
            if (attempt < maxBackoffMs.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, maxBackoffMs[attempt]))
            }
          }
        }
        if (!sent) {
          const maxFailureReason = lastError || 'max_retry_exhausted'
          await upsertNotificationEvent(event, {
            key,
            input,
            channel: recipient.channel,
            conversationId: recipient.conversationId,
            status: 'failed',
            lastError: maxFailureReason,
          })

          let fallbackTelegramTarget: string | null = null
          if (recipient.targetType === 'customer') {
            fallbackTelegramTarget = input.actorContext?.customerTelegramId
              ? String(input.actorContext.customerTelegramId)
              : null
          } else if (recipient.targetType === 'manager_group') {
            fallbackTelegramTarget = defaultManagerTelegramChatId || null
          }

          if (!fallbackTelegramTarget) {
            throw new Error(`max_fallback_target_missing:${recipient.targetType}`)
          }

          const fallbackKey = buildNotificationKey(
            input.eventType,
            input.orderContext.orderId,
            'telegram',
            recipient.targetType,
            fallbackTelegramTarget,
          )
          const botToken = String((shopRow as any)?.telegram_bot_token || (config.botToken as string))
          await upsertNotificationEvent(event, {
            key: fallbackKey,
            input,
            channel: 'telegram',
            conversationId: fallbackTelegramTarget,
            status: 'pending',
          })
          try {
            await sendTelegramMessage(botToken, fallbackTelegramTarget, `${text}\n\n[Fallback: MAX недоступен]`)
            await upsertNotificationEvent(event, {
              key: fallbackKey,
              input,
              channel: 'telegram',
              conversationId: fallbackTelegramTarget,
              status: 'sent',
              lastError: `fallback_from_max:${maxFailureReason}`,
            })
          } catch (fallbackErr: any) {
            await upsertNotificationEvent(event, {
              key: fallbackKey,
              input,
              channel: 'telegram',
              conversationId: fallbackTelegramTarget,
              status: 'failed',
              lastError: fallbackErr?.message || 'telegram_fallback_failed',
            })
            throw fallbackErr
          }
          continue
        }
      }

      await upsertNotificationEvent(event, {
        key,
        input,
        channel: recipient.channel,
        conversationId: recipient.conversationId,
        status: 'sent',
      })
    } catch (err: any) {
      await upsertNotificationEvent(event, {
        key,
        input,
        channel: recipient.channel,
        conversationId: recipient.conversationId,
        status: 'failed',
        lastError: err?.message || 'notification_send_failed',
      })
    }
  }
}
