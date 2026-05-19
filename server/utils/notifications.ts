import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import { getUnifiedFlowConfig } from '~/server/utils/orderFlowActions'
import {
  buildCustomerStatusShortText,
  buildManagerOrderInlineKeyboard,
  loadActiveShopBranches,
} from '~/server/utils/orderChatFlow'
import { normalizeDashboardStatus } from '~/utils/dashboardOrderStatus'
import {
  loadOrderCustomerContact,
  orderContactToKeyboardContext,
  type OrderCustomerContact,
} from '~/server/utils/orderManagerCustomerContact'
import { formatManagerCustomerLine } from '~/server/utils/orderChatFlowPure'
import { persistManagerTelegramPost } from '~/server/utils/orderManagerTelegram'
import { processDueReviewPrompts, scheduleReviewPromptsAfterHanded } from '~/server/utils/reviewPromptFlow'

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
    fulfillmentType?: string
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
  maxUserId: string | null
}

type OrderDetails = {
  orderNumber: string
  status: string
  fulfillmentType: string
  paymentMethod: string
  paymentStatus: string
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

function formatOrderRef(orderNumber: string | null | undefined, orderId?: string): string {
  const raw = typeof orderNumber === 'string' && orderNumber.trim()
    ? orderNumber.trim()
    : typeof orderId === 'string' && orderId.trim()
      ? orderId.trim()
      : ''
  if (!raw) return '#—'

  const normalized = raw.replace(/\s+/g, '')
  const short = normalized.length > 8 ? normalized.slice(0, 8) : normalized
  return `#${short}`
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
): Promise<number | null> {
  const replyMarkup = options?.replyMarkup
  const hasKeyboard =
    replyMarkup
    && Array.isArray((replyMarkup as { inline_keyboard?: unknown }).inline_keyboard)
    && ((replyMarkup as { inline_keyboard: unknown[] }).inline_keyboard.length > 0)

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(hasKeyboard ? { reply_markup: replyMarkup } : {}),
    }),
  })
  const payload = await response.json().catch(() => null) as {
    ok?: boolean
    description?: string
    result?: { message_id?: number }
  } | null
  if (!response.ok || payload?.ok === false) {
    const detail = payload?.description || `http_${response.status}`
    throw new Error(`telegram_send_failed:${detail}`)
  }
  const messageId = payload?.result?.message_id
  return typeof messageId === 'number' && Number.isFinite(messageId) ? Math.floor(messageId) : null
}

async function sendMaxMessage(
  baseUrl: string,
  token: string,
  target: { conversationId?: string | null; userId?: string | null },
  text: string,
  attachments?: Array<Record<string, unknown>>,
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '')
  const hasConversation = typeof target.conversationId === 'string' && target.conversationId.trim()
  const hasUserId = typeof target.userId === 'string' && target.userId.trim()
  if (!hasConversation && !hasUserId) {
    throw new Error('max_send_target_missing')
  }

  const send = async (mode: 'conversation' | 'user'): Promise<Response> => {
    const url = mode === 'conversation'
      ? `${base}/messages`
      : `${base}/messages?user_id=${encodeURIComponent(String(target.userId))}`
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(mode === 'conversation' ? { conversationId: String(target.conversationId) } : {}),
        text,
        ...(attachments?.length ? { attachments } : {}),
      }),
    })
  }

  let response = await send(hasConversation ? 'conversation' : 'user')
  if (!response.ok) {
    const bodyText = await response.text()
    const isUnknownRecipient = response.status === 400 && /unknown recipient|proto\.payload/i.test(bodyText)
    if (hasConversation && hasUserId && isUnknownRecipient) {
      response = await send('user')
      if (!response.ok) {
        const fallbackBody = await response.text()
        throw new Error(`max_send_failed:${response.status}:${fallbackBody}`)
      }
      return
    }
    throw new Error(`max_send_failed:${response.status}:${bodyText}`)
  }

  return
}

function makeBridgeKey(): string {
  return randomBytes(9).toString('base64url')
}

async function createOrderBridgeToken(event: H3Event, shopId: string, orderId: string, role: 'customer' | 'manager'): Promise<string | null> {
  const client = await serverSupabaseServiceRole(event)
  const bridgeKey = makeBridgeKey()
  const { error } = await client
    .from('auth_bridge_sessions')
    .insert({
      bridge_key: bridgeKey,
      shop_id: shopId,
      scope_key: shopId,
      payload: {
        type: 'order',
        orderId,
        shopId,
        role,
      },
    })
  if (error) return null
  return `order_${bridgeKey}`
}

function buildManagerMessage(payload: {
  orderDetails: OrderDetails
  orderId: string
  brandName: string
  branchName: string
  branchAddress: string
  cityName: string
  customerHandle: string
}): string {
  const order = payload.orderDetails
  const lines: string[] = [
    `🔔 Новый заказ ${formatOrderRef(order.orderNumber, payload.orderId)}`,
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
  orderId: string
  brandName: string
  branchName: string
  branchAddress: string
  cityName: string
}): string {
  const order = payload.orderDetails
  const lines: string[] = [
    `📦 Заказ ${formatOrderRef(order.orderNumber, payload.orderId)}`,
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

/** Короткие тексты при смене статуса (как кнопки в менеджерском чате), без полного состава заказа. */
function buildCustomerOrderStatusShortMessage(orderRef: string, status: string, fulfillmentType: string): string | null {
  const normalized = normalizeDashboardStatus(status)
  return buildCustomerStatusShortText(orderRef, normalized, fulfillmentType)
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

function getPaymentLine(order: OrderDetails): string {
  const method = order.paymentMethod.trim().toLowerCase()
  const status = order.paymentStatus.trim().toLowerCase()

  if (method === 'online') {
    return status === 'paid'
      ? '💸 Способ оплаты: Онлайн (оплачен)'
      : '💸 Способ оплаты: Онлайн (ожидает оплаты)'
  }
  if (method === 'card') return '💸 Способ оплаты: Картой при получении'
  if (method === 'cash') return '💸 Способ оплаты: Наличными при получении'
  return `💸 Способ оплаты: ${order.paymentMethod || 'Не указан'}`
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
  lines.push(getPaymentLine(order))
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
    .select('order_number,status,fulfillment_type,payment_method,payment_status,subtotal,delivery_cost,total,discount_amount,bonus_amount_spent,promo_snapshot,promo_code_id,items,address,pickup_point')
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
    paymentStatus: String((row as any)?.payment_status || ''),
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

  /** Смена статуса — только клиент; менеджеры не дублируют полную карточку в группе. */
  if (input.eventType !== 'ORDER_STATUS_CHANGED') {
    if (mode === 'group') {
      const tgGroupId = typeof (restaurant as any)?.manager_group_chat_id === 'string'
        ? (restaurant as any).manager_group_chat_id.trim()
        : ''
      const maxGroupId = typeof (restaurant as any)?.manager_max_chat_id === 'string'
        ? (restaurant as any).manager_max_chat_id.trim()
        : ''
      if (tgGroupId) {
        recipients.push({ channel: 'telegram', targetType: 'manager_group', targetId: tgGroupId, conversationId: tgGroupId, maxUserId: null })
      }
      if (maxGroupId) {
        recipients.push({ channel: 'max', targetType: 'manager_group', targetId: maxGroupId, conversationId: maxGroupId, maxUserId: null })
      }
    } else {
      for (const manager of managerRecipients) {
        const channel = manager.channel === 'max' ? 'max' : manager.channel === 'telegram' ? 'telegram' : null
        const targetId = typeof manager.targetId === 'string' ? manager.targetId.trim() : ''
        if (!channel || !targetId) continue
        recipients.push({ channel, targetType: 'manager_user', targetId, conversationId: targetId, maxUserId: null })
      }
    }
  }

  if (input.actorContext?.customerTelegramId) {
    const chatId = String(input.actorContext.customerTelegramId)
    recipients.push({ channel: 'telegram', targetType: 'customer', targetId: chatId, conversationId: chatId, maxUserId: null })
  }
  if (input.actorContext?.customerMaxConversationId || input.actorContext?.customerMaxUserId) {
    const maxConversationId = typeof input.actorContext?.customerMaxConversationId === 'string'
      ? input.actorContext.customerMaxConversationId
      : null
    const maxUserId = typeof input.actorContext?.customerMaxUserId === 'string'
      ? input.actorContext.customerMaxUserId
      : null
    recipients.push({
      channel: 'max',
      targetType: 'customer',
      targetId: maxConversationId || maxUserId || '',
      conversationId: maxConversationId,
      maxUserId,
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
  if (!recipients.length) return

  const { data: shopRow } = await client
    .from('shops')
    .select('name,telegram_bot_token,manager_chat_id,channel_policy')
    .eq('id', input.tenantContext.shopId)
    .maybeSingle()
  const { data: branchRow } = await client
    .from('restaurants')
    .select('name,address,manager_group_chat_id,integration_keys')
    .eq('id', input.tenantContext.restaurantId)
    .maybeSingle()
  const { data: cityRow } = input.tenantContext.cityId
    ? await client.from('cities').select('name').eq('id', input.tenantContext.cityId).maybeSingle()
    : { data: null as any }

  const brandName = String((shopRow as any)?.name || '—')
  const branchName = String((branchRow as any)?.name || '—')
  const branchAddress = String((branchRow as any)?.address || 'Адрес не указан')
  const cityName = String((cityRow as any)?.name || '—')
  let orderContact: OrderCustomerContact | null = null
  try {
    orderContact = await loadOrderCustomerContact(event, input.orderContext.orderId)
  } catch (err) {
    console.error('dispatchNotificationEvent loadOrderCustomerContact:', err)
  }
  if (orderContact && input.actorContext) {
    if (!orderContact.customerMaxUserId && input.actorContext.customerMaxUserId) {
      orderContact = {
        ...orderContact,
        customerMaxUserId: String(input.actorContext.customerMaxUserId).trim() || null,
      }
    }
    if (!orderContact.customerMaxConversationId && input.actorContext.customerMaxConversationId) {
      orderContact = {
        ...orderContact,
        customerMaxConversationId: String(input.actorContext.customerMaxConversationId).trim() || null,
      }
    }
    if (!orderContact.customerTelegramId && input.actorContext.customerTelegramId) {
      orderContact = {
        ...orderContact,
        customerTelegramId: input.actorContext.customerTelegramId,
      }
    }
  }
  const customerHandle = orderContact
    ? formatManagerCustomerLine(orderContactToKeyboardContext(orderContact))
    : input.actorContext?.customerTelegramId
      ? `Telegram id:${input.actorContext.customerTelegramId}`
      : input.actorContext?.customerMaxUserId
        ? `MAX id:${input.actorContext.customerMaxUserId}`
        : 'контакт уточняется'
  const orderDetails = await loadOrderDetails(event, input)
  const managerText = buildManagerMessage({
    orderDetails,
    orderId: input.orderContext.orderId,
    brandName,
    branchName,
    branchAddress,
    cityName,
    customerHandle,
  })
  const customerText = buildCustomerMessage({
    orderDetails,
    orderId: input.orderContext.orderId,
    brandName,
    branchName,
    branchAddress,
    cityName,
  })
  const orderRef = formatOrderRef(orderDetails.orderNumber, input.orderContext.orderId)
  const fulfillmentForCustomer = input.orderContext.fulfillmentType || orderDetails.fulfillmentType
  const customerStatusShortText = buildCustomerOrderStatusShortMessage(orderRef, orderDetails.status, fulfillmentForCustomer)

  const maxBaseUrl = String((config as any).maxApiBaseUrl || '')
  const maxToken = String((config as any).maxApiToken || '')
  const maxBotUrl = String((config.public as any)?.maxBotUrl || '').trim()
  const telegramBotName = String((config.public as any)?.telegramBotName || '').trim()
  const appUrlBase = String((config as any).appUrl || '').replace(/\/$/, '')
  const dashboardOrderUrl = appUrlBase
    ? `${appUrlBase}/dashboard/orders/${encodeURIComponent(input.orderContext.orderId)}`
    : ''
  const maxBackoffMs = [30_000, 120_000, 600_000]
  /** Достаточно NUXT_MAX_* в рантайме; маршрут TG↔MAX задаётся получателями (ресторан / клиент), не флагом магазина. */
  const maxEnabledByRuntime = Boolean(maxBaseUrl && maxToken)
  const defaultManagerTelegramChatId =
    typeof (branchRow as any)?.manager_group_chat_id === 'string' && (branchRow as any).manager_group_chat_id.trim()
      ? String((branchRow as any).manager_group_chat_id).trim()
      : typeof (shopRow as any)?.manager_chat_id === 'string'
        ? String((shopRow as any).manager_chat_id).trim()
        : ''

  for (const recipient of recipients) {
    const key = buildNotificationKey(input.eventType, input.orderContext.orderId, recipient.channel, recipient.targetType, recipient.targetId)
    const isManagerTarget = recipient.targetType === 'manager_group' || recipient.targetType === 'manager_user'
    const isCustomerTarget = recipient.targetType === 'customer'
    if (isCustomerTarget && input.eventType === 'ORDER_STATUS_CHANGED' && !customerStatusShortText) {
      continue
    }

    const text =
      isManagerTarget && input.eventType === 'ORDER_CREATED'
        ? managerText
        : isCustomerTarget && input.eventType === 'ORDER_STATUS_CHANGED'
          ? (customerStatusShortText || customerText)
          : customerText

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
        const customerBridgeToken = await createOrderBridgeToken(event, input.tenantContext.shopId, input.orderContext.orderId, 'customer')
        const customerMiniAppUrl = customerBridgeToken && telegramBotName
          ? `https://t.me/${telegramBotName}?startapp=${encodeURIComponent(customerBridgeToken)}`
          : ''
        const flowConfig = await getUnifiedFlowConfig(event, input.tenantContext.restaurantId)
        const shopBranches =
          input.eventType === 'ORDER_CREATED' && recipient.targetType !== 'customer'
            ? await loadActiveShopBranches(event, input.tenantContext.shopId)
            : []
        const contactKeyboardCtx = orderContact
          ? orderContactToKeyboardContext(orderContact, {
              maxBotUrl,
              allowTelegramUserLink: recipient.targetType === 'manager_user',
            })
          : {
              orderId: input.orderContext.orderId,
              customerTelegramId: input.actorContext?.customerTelegramId ?? null,
              customerMaxUserId: input.actorContext?.customerMaxUserId ?? null,
              customerPhone: null,
              orderClientChannel: null,
              maxBotUrl,
              allowTelegramUserLink: recipient.targetType === 'manager_user',
            }
        const finalManagerKeyboard =
          input.eventType === 'ORDER_CREATED' && recipient.targetType !== 'customer'
            ? buildManagerOrderInlineKeyboard({
                orderId: input.orderContext.orderId,
                fulfillmentType: orderDetails.fulfillmentType,
                orderStatus: orderDetails.status,
                customerTelegramId: contactKeyboardCtx.customerTelegramId,
                customerMaxUserId: contactKeyboardCtx.customerMaxUserId,
                customerPhone: contactKeyboardCtx.customerPhone,
                orderClientChannel: contactKeyboardCtx.orderClientChannel,
                maxBotUrl: contactKeyboardCtx.maxBotUrl,
                allowTelegramUserLink: contactKeyboardCtx.allowTelegramUserLink,
                dashboardOrderUrl,
                etaButtonsEnabled: flowConfig.etaButtonsEnabled,
                etaPresets: flowConfig.etaPresets,
                branchPickerEnabled: shopBranches.length > 1,
              })
            : null
        const customerKeyboardRows: Array<Array<Record<string, string>>> = []
        if (recipient.targetType === 'customer') {
          if (input.eventType === 'ORDER_CREATED') {
            customerKeyboardRows.push([{ text: '⏱ Сообщить о задержке', callback_data: `clientDelay_${input.orderContext.orderId}` }])
          }
          if (customerMiniAppUrl) {
            customerKeyboardRows.push([{ text: '📱 Открыть заказ', url: customerMiniAppUrl }])
          }
        }
        const customerKeyboard = customerKeyboardRows.length ? { inline_keyboard: customerKeyboardRows } : null
        const replyMarkup = finalManagerKeyboard || customerKeyboard || undefined
        let sentMessageId: number | null = null
        try {
          sentMessageId = await sendTelegramMessage(
            botToken,
            recipient.targetId,
            text,
            { replyMarkup },
          )
        } catch (sendErr) {
          if (replyMarkup) {
            try {
              sentMessageId = await sendTelegramMessage(botToken, recipient.targetId, text)
            } catch (retryErr) {
              throw retryErr
            }
          } else {
            throw sendErr
          }
        }
        if (
          input.eventType === 'ORDER_CREATED'
          && isManagerTarget
          && sentMessageId != null
        ) {
          await persistManagerTelegramPost(event, {
            shopId: input.tenantContext.shopId,
            orderId: input.orderContext.orderId,
            post: {
              chatId: recipient.targetId,
              messageId: sentMessageId,
              branchId: input.tenantContext.restaurantId,
            },
          }).catch((err) => {
            console.error('persistManagerTelegramPost:', err)
          })
        }
      } else {
        if (!maxEnabledByRuntime) {
          await upsertNotificationEvent(event, {
            key,
            input,
            channel: recipient.channel,
            conversationId: recipient.conversationId,
            status: 'failed',
            lastError: 'max_api_not_configured',
          })
          continue
        }
        let sent = false
        let lastError: string | null = null
        for (let attempt = 0; attempt < maxBackoffMs.length; attempt += 1) {
          try {
            const customerBridgeToken = await createOrderBridgeToken(event, input.tenantContext.shopId, input.orderContext.orderId, 'customer')
            const customerMaxMiniAppUrl = customerBridgeToken && maxBotUrl
              ? `${maxBotUrl}${maxBotUrl.includes('?') ? '&' : '?'}startapp=${encodeURIComponent(customerBridgeToken)}&start_param=${encodeURIComponent(customerBridgeToken)}`
              : ''
            const maxAttachments: Array<Record<string, unknown>> = []
            const buttons: Array<Array<Record<string, string>>> = []
            if (recipient.targetType === 'customer' && customerMaxMiniAppUrl) {
              buttons.push([{ type: 'link', text: 'Открыть заказ', url: customerMaxMiniAppUrl }])
            }
            if (recipient.targetType !== 'customer') {
              if (dashboardOrderUrl) buttons.push([{ type: 'link', text: 'Открыть заказ (менеджер)', url: dashboardOrderUrl }])
            }
            if (buttons.length) {
              maxAttachments.push({
                type: 'inline_keyboard',
                payload: { buttons },
              })
            }
            await sendMaxMessage(
              maxBaseUrl,
              maxToken,
              { conversationId: recipient.conversationId, userId: recipient.maxUserId },
              text,
              maxAttachments,
            )
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

  if (input.eventType === 'ORDER_STATUS_CHANGED' && input.orderContext.status === 'handed_to_customer') {
    await scheduleReviewPromptsAfterHanded(event, input).catch((err) => {
      console.error('scheduleReviewPromptsAfterHanded:', err)
    })
    await processDueReviewPrompts(event, { limit: 8 }).catch((err) => {
      console.error('processDueReviewPrompts:', err)
    })
  }
}
