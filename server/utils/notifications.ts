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

type OrderDetails = {
  orderNumber: string
  status: string
  fulfillmentType: string
  paymentMethod: string
  subtotal: number
  deliveryCost: number
  total: number
  discountAmount: number
  bonusSpent: number
  promoCode: string | null
  items: Array<Record<string, any>>
  addressLine: string | null
  addressFlat: string | null
  addressComment: string | null
  pickupPointName: string | null
  pickupPointAddress: string | null
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

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  options?: { replyMarkup?: Record<string, unknown> },
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
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
      Authorization: token,
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
  orderDetails: OrderDetails
  brandName: string
  branchName: string
  branchAddress: string
  cityName: string
  customerHandle: string
}): string {
  const order = payload.orderDetails
  const lines: string[] = [
    `🔔 Новый заказ #${order.orderNumber}`,
    `🏪 ${payload.brandName} • ${payload.branchName}`,
    `📍 ${payload.branchAddress}, ${payload.cityName}`,
    `Клиент: ${payload.customerHandle}`,
    '',
    '🧾 Состав:',
    ...formatItems(order.items),
    '',
    ...buildMoneyBlock(order),
    '',
    ...buildFulfillmentBlock(order),
  ]
  return lines.join('\n')
}

function buildCustomerMessage(payload: {
  orderDetails: OrderDetails
  brandName: string
  branchName: string
  branchAddress: string
  cityName: string
}): string {
  const order = payload.orderDetails
  const lines: string[] = [
    `📦 Заказ #${order.orderNumber}`,
    `Статус: ${getStatusLabel(order.status)}`,
    `🏪 ${payload.brandName} • ${payload.branchName}`,
    `📍 ${payload.branchAddress}, ${payload.cityName}`,
    '',
    '🧾 Состав заказа:',
    ...formatItems(order.items),
    '',
    ...buildMoneyBlock(order),
    '',
    ...buildFulfillmentBlock(order),
  ]
  return lines.join('\n')
}

function formatRub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
}

function formatItems(items: Array<Record<string, any>>): string[] {
  if (!Array.isArray(items) || !items.length) return ['• Состав временно недоступен']
  const lines: string[] = []
  for (const item of items.slice(0, 15)) {
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Позиция'
    const qty = Number(item.quantity || 0) > 0 ? Number(item.quantity) : 1
    const price = Number(item.price || 0)
    lines.push(`• ${name} × ${qty} — ${formatRub(price * qty)}`)
  }
  if (items.length > 15) lines.push(`… и ещё ${items.length - 15} поз.`)
  return lines
}

function buildMoneyBlock(order: OrderDetails): string[] {
  const lines = [
    `💰 Товары: ${formatRub(order.subtotal)}`,
    `🚚 Доставка: ${formatRub(order.deliveryCost)}`,
  ]
  if (order.discountAmount > 0) lines.push(`🎁 Скидка: −${formatRub(order.discountAmount)}`)
  if (order.bonusSpent > 0) lines.push(`⭐ Бонусы: −${formatRub(order.bonusSpent)}`)
  if (order.promoCode) lines.push(`🏷 Промокод: ${order.promoCode}`)
  lines.push(`💳 Итого: ${formatRub(order.total)}`)
  return lines
}

function buildFulfillmentBlock(order: OrderDetails): string[] {
  const lines: string[] = []
  if (order.fulfillmentType === 'pickup') {
    lines.push('🏬 Получение: Самовывоз')
    if (order.pickupPointName || order.pickupPointAddress) {
      lines.push(`Пункт: ${[order.pickupPointName, order.pickupPointAddress].filter(Boolean).join(', ')}`)
    }
  } else {
    lines.push('🚚 Получение: Доставка')
    if (order.addressLine) {
      lines.push(`Адрес: ${[order.addressLine, order.addressFlat].filter(Boolean).join(', ')}`)
    }
  }
  if (order.addressComment) lines.push(`📝 Комментарий: ${order.addressComment}`)
  return lines
}

async function loadOrderDetails(event: H3Event, input: NotificationEvent): Promise<OrderDetails> {
  const client = await serverSupabaseServiceRole(event)
  const { data: row } = await client
    .from('orders')
    .select('order_number,status,fulfillment_type,payment_method,subtotal,delivery_cost,total,discount_amount,bonus_amount_spent,promo_snapshot,promo_code_id,items,address,pickup_point')
    .eq('id', input.orderContext.orderId)
    .maybeSingle()

  const promoCodeId = (row as any)?.promo_code_id as string | null | undefined
  let promoCode: string | null = null
  if (promoCodeId) {
    const { data: promoRow } = await client.from('shop_promo_codes').select('code').eq('id', promoCodeId).maybeSingle()
    promoCode = typeof (promoRow as any)?.code === 'string' ? String((promoRow as any).code) : null
  }

  const address = ((row as any)?.address || {}) as Record<string, any>
  const pickup = ((row as any)?.pickup_point || {}) as Record<string, any>
  const items = Array.isArray((row as any)?.items) ? ((row as any).items as Array<Record<string, any>>) : []

  return {
    orderNumber: String((row as any)?.order_number || input.orderContext.orderNumber || input.orderContext.orderId),
    status: String((row as any)?.status || input.orderContext.status || 'new'),
    fulfillmentType: String((row as any)?.fulfillment_type || 'delivery'),
    paymentMethod: String((row as any)?.payment_method || ''),
    subtotal: Number((row as any)?.subtotal || input.orderContext.totalAmount || 0),
    deliveryCost: Number((row as any)?.delivery_cost || 0),
    total: Number((row as any)?.total || input.orderContext.totalAmount || 0),
    discountAmount: Number((row as any)?.discount_amount || 0),
    bonusSpent: Number((row as any)?.bonus_amount_spent || 0),
    promoCode,
    items,
    addressLine: typeof address.line === 'string' ? address.line : null,
    addressFlat: typeof address.flat === 'string' ? address.flat : null,
    addressComment: typeof address.comment === 'string' ? address.comment : null,
    pickupPointName: typeof pickup.name === 'string' ? pickup.name : null,
    pickupPointAddress: typeof pickup.address === 'string' ? pickup.address : null,
  }
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
    .select('name,address,manager_group_chat_id')
    .eq('id', input.tenantContext.restaurantId)
    .maybeSingle()
  const { data: cityRow } = input.tenantContext.cityId
    ? await client.from('cities').select('name').eq('id', input.tenantContext.cityId).maybeSingle()
    : { data: null as any }

  const brandName = String((shopRow as any)?.name || '—')
  const branchName = String((branchRow as any)?.name || '—')
  const branchAddress = String((branchRow as any)?.address || 'Адрес не указан')
  const cityName = String((cityRow as any)?.name || '—')
  const customerHandle = input.actorContext?.customerTelegramId ? `id:${input.actorContext.customerTelegramId}` : 'id:unknown'
  const orderDetails = await loadOrderDetails(event, input)
  const managerText = buildManagerMessage({
    orderDetails,
    brandName,
    branchName,
    branchAddress,
    cityName,
    customerHandle,
  })
  const customerText = buildCustomerMessage({
    orderDetails,
    brandName,
    branchName,
    branchAddress,
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
        const managerKeyboard = input.eventType === 'ORDER_CREATED' && recipient.targetType !== 'customer' && input.actorContext?.customerTelegramId
          ? {
              inline_keyboard: [
                [
                  { text: '👨‍🍳 Принять в работу', callback_data: `work_${input.actorContext.customerTelegramId}_${input.orderContext.orderId}` },
                  { text: '⏱ Задержка (кухня)', callback_data: `delayWork_${input.actorContext.customerTelegramId}_${input.orderContext.orderId}` },
                ],
                [
                  { text: '✉️ Написать клиенту', url: `tg://user?id=${input.actorContext.customerTelegramId}` },
                ],
              ],
            }
          : null
        const customerKeyboard = recipient.targetType === 'customer' && input.eventType !== 'ORDER_STATUS_CHANGED'
          ? {
              inline_keyboard: [[{ text: '⏱ Сообщить о задержке', callback_data: `clientDelay_${input.orderContext.orderId}` }]],
            }
          : null
        await sendTelegramMessage(
          botToken,
          recipient.targetId,
          text,
          { replyMarkup: managerKeyboard || customerKeyboard || undefined },
        )
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
