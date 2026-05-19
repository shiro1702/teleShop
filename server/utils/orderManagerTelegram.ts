import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import { getUnifiedFlowConfig } from '~/server/utils/orderFlowActions'
import { buildManagerOrderInlineKeyboard, loadActiveShopBranches, type ShopBranchRow } from '~/server/utils/orderChatFlow'
import { buildOrderTransferredNoticeText, formatManagerCustomerLine } from '~/server/utils/orderChatFlowPure'
import {
  loadOrderCustomerContact,
  orderContactToKeyboardContext,
} from '~/server/utils/orderManagerCustomerContact'

export type ManagerTelegramPost = {
  chatId: string
  messageId: number
  branchId: string | null
}

type ManagerOrderDetails = {
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
  customerTelegramId: number | null
}

function formatOrderRef(orderNumber: string, orderId: string): string {
  const raw = orderNumber.trim() || orderId.trim()
  const normalized = raw.replace(/\s+/g, '')
  const short = normalized.length > 8 ? normalized.slice(0, 8) : normalized
  return `#${short || '—'}`
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

function getPaymentLine(order: ManagerOrderDetails): string {
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

function buildMoneyBlock(order: ManagerOrderDetails): string[] {
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

function buildFulfillmentBlock(order: ManagerOrderDetails): string[] {
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

function buildManagerCardText(payload: {
  order: ManagerOrderDetails
  orderId: string
  brandName: string
  branchName: string
  branchAddress: string
  cityName: string
  customerContactLine?: string
}): string {
  const customerHandle = payload.customerContactLine || 'контакт уточняется'
  return [
    `🔔 Новый заказ ${formatOrderRef(payload.order.orderNumber, payload.orderId)}`,
    `🏪 ${payload.brandName} • ${payload.branchName}`,
    `📍 ${payload.branchAddress}, ${payload.cityName}`,
    `Клиент: ${customerHandle}`,
    '',
    '🧾 Состав:',
    ...formatItems(payload.order.items),
    '',
    ...buildMoneyBlock(payload.order),
    '',
    ...buildFulfillmentBlock(payload.order),
  ].join('\n')
}

async function loadManagerOrderDetails(event: H3Event, orderId: string): Promise<ManagerOrderDetails | null> {
  const client = await serverSupabaseServiceRole(event)
  const { data: row } = await client
    .from('orders')
    .select('order_number,status,fulfillment_type,payment_method,payment_status,subtotal,delivery_cost,total,discount_amount,bonus_amount_spent,promo_code_id,items,address,pickup_point,customer_telegram_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!row) return null

  const promoCodeId = (row as any)?.promo_code_id as string | null | undefined
  let promoCode: string | null = null
  if (promoCodeId) {
    const { data: promoRow } = await client.from('shop_promo_codes').select('code').eq('id', promoCodeId).maybeSingle()
    promoCode = typeof (promoRow as any)?.code === 'string' ? String((promoRow as any).code) : null
  }

  const address = ((row as any)?.address || {}) as Record<string, any>
  const pickup = ((row as any)?.pickup_point || {}) as Record<string, any>
  const items = Array.isArray((row as any)?.items) ? ((row as any).items as Array<Record<string, any>>) : []
  const tgRaw = (row as any)?.customer_telegram_id
  const customerTelegramId =
    tgRaw !== null && tgRaw !== undefined && Number.isFinite(Number(tgRaw)) && Number(tgRaw) > 0
      ? Number(tgRaw)
      : null

  return {
    orderNumber: String((row as any)?.order_number || orderId),
    status: String((row as any)?.status || 'new'),
    fulfillmentType: String((row as any)?.fulfillment_type || 'delivery'),
    paymentMethod: String((row as any)?.payment_method || ''),
    paymentStatus: String((row as any)?.payment_status || ''),
    subtotal: Number((row as any)?.subtotal || 0),
    deliveryCost: Number((row as any)?.delivery_cost || 0),
    total: Number((row as any)?.total || 0),
    discountAmount: Number((row as any)?.discount_amount || 0),
    bonusSpent: Number((row as any)?.bonus_amount_spent || 0),
    promoCode,
    items,
    addressLine: typeof address.line === 'string' ? address.line : null,
    addressFlat: typeof address.flat === 'string' ? address.flat : null,
    addressComment: typeof address.comment === 'string' ? address.comment : null,
    pickupPointName: typeof pickup.name === 'string' ? pickup.name : null,
    pickupPointAddress: typeof pickup.address === 'string' ? pickup.address : null,
    customerTelegramId,
  }
}

export async function buildManagerOrderTelegramPayload(
  event: H3Event,
  args: {
    shopId: string
    restaurantId: string
    orderId: string
    cityId?: string | null
  },
): Promise<{ text: string; replyMarkup: { inline_keyboard: Array<Array<Record<string, string>>> } | null; orderRef: string } | null> {
  const client = await serverSupabaseServiceRole(event)
  const order = await loadManagerOrderDetails(event, args.orderId)
  if (!order) return null
  const orderContact = await loadOrderCustomerContact(event, args.orderId)

  const { data: shopRow } = await client.from('shops').select('name').eq('id', args.shopId).maybeSingle()
  const { data: branchRow } = await client
    .from('restaurants')
    .select('name,address')
    .eq('id', args.restaurantId)
    .maybeSingle()
  const { data: cityRow } = args.cityId
    ? await client.from('cities').select('name').eq('id', args.cityId).maybeSingle()
    : { data: null as any }

  const config = useRuntimeConfig(event)
  const maxBotUrl = String((config.public as any)?.maxBotUrl || '').trim()
  const appUrlBase = String((config as any).appUrl || '').replace(/\/$/, '')
  const dashboardOrderUrl = appUrlBase
    ? `${appUrlBase}/dashboard/orders/${encodeURIComponent(args.orderId)}`
    : ''
  const flowConfig = await getUnifiedFlowConfig(event, args.restaurantId)
  const shopBranches = await loadActiveShopBranches(event, args.shopId)
  const contactKeyboardCtx = orderContact
    ? orderContactToKeyboardContext(orderContact, { maxBotUrl, allowTelegramUserLink: false })
    : null

  const text = buildManagerCardText({
    order,
    orderId: args.orderId,
    brandName: String((shopRow as any)?.name || '—'),
    branchName: String((branchRow as any)?.name || '—'),
    branchAddress: String((branchRow as any)?.address || 'Адрес не указан'),
    cityName: String((cityRow as any)?.name || '—'),
    customerContactLine: contactKeyboardCtx
      ? formatManagerCustomerLine(contactKeyboardCtx)
      : undefined,
  })
  const replyMarkup = buildManagerOrderInlineKeyboard({
    orderId: args.orderId,
    fulfillmentType: order.fulfillmentType,
    orderStatus: order.status,
    customerTelegramId: contactKeyboardCtx?.customerTelegramId ?? order.customerTelegramId,
    customerMaxUserId: contactKeyboardCtx?.customerMaxUserId ?? null,
    customerPhone: contactKeyboardCtx?.customerPhone ?? null,
    orderClientChannel: contactKeyboardCtx?.orderClientChannel ?? null,
    maxBotUrl,
    allowTelegramUserLink: false,
    dashboardOrderUrl,
    etaButtonsEnabled: flowConfig.etaButtonsEnabled,
    etaPresets: flowConfig.etaPresets,
    branchPickerEnabled: shopBranches.length > 1,
  })

  return { text, replyMarkup, orderRef: formatOrderRef(order.orderNumber, args.orderId) }
}

function parseManagerTelegramPosts(metadata: unknown): ManagerTelegramPost[] {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = (metadata as { manager_telegram_posts?: unknown }).manager_telegram_posts
  if (!Array.isArray(raw)) return []
  const posts: ManagerTelegramPost[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const chatId = typeof (item as any).chatId === 'string' ? (item as any).chatId.trim() : ''
    const messageId = Number((item as any).messageId)
    if (!chatId || !Number.isFinite(messageId)) continue
    const branchIdRaw = (item as any).branchId
    posts.push({
      chatId,
      messageId: Math.floor(messageId),
      branchId: typeof branchIdRaw === 'string' && branchIdRaw.trim() ? branchIdRaw.trim() : null,
    })
  }
  return posts
}

export async function persistManagerTelegramPost(
  event: H3Event,
  args: { shopId: string; orderId: string; post: ManagerTelegramPost },
): Promise<void> {
  const client = await serverSupabaseServiceRole(event)
  const { data: order } = await client
    .from('orders')
    .select('metadata')
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (!order) return

  const metadata =
    (order as any).metadata && typeof (order as any).metadata === 'object'
      ? { ...((order as any).metadata as Record<string, unknown>) }
      : {}
  const posts = parseManagerTelegramPosts(metadata)
  const next = posts.filter((p) => p.chatId !== args.post.chatId)
  next.push(args.post)
  metadata.manager_telegram_posts = next

  await client
    .from('orders')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
}

async function telegramApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok?: boolean; result?: { message_id?: number }; description?: string } | null> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null
}

async function editTelegramToTransferred(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  const payload = await telegramApi(botToken, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  })
  if (payload?.ok === false) {
    throw new Error(payload.description || 'telegram_edit_failed')
  }
}

async function sendTelegramManagerCard(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup: { inline_keyboard: Array<Array<Record<string, string>>> } | null,
): Promise<number | null> {
  const hasKeyboard = Boolean(replyMarkup?.inline_keyboard?.length)
  const payload = await telegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(hasKeyboard ? { reply_markup: replyMarkup } : {}),
  })
  if (payload?.ok === false) {
    throw new Error(payload.description || 'telegram_send_failed')
  }
  const messageId = payload?.result?.message_id
  return typeof messageId === 'number' && Number.isFinite(messageId) ? Math.floor(messageId) : null
}

export async function syncTelegramChatsAfterBranchTransfer(
  event: H3Event,
  args: {
    botToken: string
    shopId: string
    orderId: string
    cityId: string | null
    previousBranchId: string | null
    newBranchId: string
    newBranchName: string
    branches: ShopBranchRow[]
    actingChatId: string
    actingMessageId: number
  },
): Promise<void> {
  const card = await buildManagerOrderTelegramPayload(event, {
    shopId: args.shopId,
    restaurantId: args.newBranchId,
    orderId: args.orderId,
    cityId: args.cityId,
  })
  if (!card) return

  const transferNotice = buildOrderTransferredNoticeText(card.orderRef, args.newBranchName)
  const newBranchChatId = args.branches.find((b) => b.id === args.newBranchId)?.managerGroupChatId || null
  const previousBranchChatId = args.previousBranchId
    ? args.branches.find((b) => b.id === args.previousBranchId)?.managerGroupChatId || null
    : null

  const client = await serverSupabaseServiceRole(event)
  const { data: orderRow } = await client
    .from('orders')
    .select('metadata')
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  const knownPosts = parseManagerTelegramPosts((orderRow as any)?.metadata)

  const targets = new Map<string, ManagerTelegramPost>()
  for (const post of knownPosts) {
    targets.set(`${post.chatId}:${post.messageId}`, post)
  }
  targets.set(`${args.actingChatId}:${args.actingMessageId}`, {
    chatId: args.actingChatId,
    messageId: args.actingMessageId,
    branchId: args.previousBranchId,
  })

  const actingIsNewBranch = Boolean(newBranchChatId && args.actingChatId === newBranchChatId)

  for (const post of targets.values()) {
    const isActing = post.chatId === args.actingChatId && post.messageId === args.actingMessageId
    if (isActing && actingIsNewBranch) {
      const payload = await telegramApi(args.botToken, 'editMessageText', {
        chat_id: post.chatId,
        message_id: post.messageId,
        text: card.text,
        reply_markup: card.replyMarkup,
      })
      if (payload?.ok !== false) {
        await persistManagerTelegramPost(event, {
          shopId: args.shopId,
          orderId: args.orderId,
          post: { chatId: post.chatId, messageId: post.messageId, branchId: args.newBranchId },
        })
      }
      continue
    }

    const isNewBranchChat = Boolean(newBranchChatId && post.chatId === newBranchChatId)
    if (isNewBranchChat) continue

    const shouldMarkTransferred =
      post.branchId === args.previousBranchId
      || (previousBranchChatId && post.chatId === previousBranchChatId)
      || isActing

    if (!shouldMarkTransferred) continue

    try {
      await editTelegramToTransferred(args.botToken, post.chatId, post.messageId, transferNotice)
    } catch (err) {
      console.error('syncTelegramChatsAfterBranchTransfer mark transferred:', err)
    }
  }

  if (newBranchChatId && !actingIsNewBranch) {
    try {
      const messageId = await sendTelegramManagerCard(args.botToken, newBranchChatId, card.text, card.replyMarkup)
      if (messageId != null) {
        await persistManagerTelegramPost(event, {
          shopId: args.shopId,
          orderId: args.orderId,
          post: { chatId: newBranchChatId, messageId, branchId: args.newBranchId },
        })
      }
    } catch (err) {
      console.error('syncTelegramChatsAfterBranchTransfer send to new branch:', err)
    }
  }
}
