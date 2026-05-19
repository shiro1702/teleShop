import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import { getProfilePhone } from '~/server/utils/accountPhoneLink'
import { canManageOrderFromManagerChat } from '~/server/utils/orderChatFlow'
import {
  buildOrderContactCallback,
  formatManagerCustomerLine,
  type ManagerCustomerContactContext,
  type OrderClientChannel,
} from '~/server/utils/orderChatFlowPure'

type ManagerKeyboardBase = {
  orderId: string
  fulfillmentType: string
  orderStatus: string
  dashboardOrderUrl?: string
  etaButtonsEnabled?: boolean
  etaPresets?: number[]
  branchPickerEnabled?: boolean
  allowTelegramUserLink?: boolean
}

export type OrderCustomerContact = {
  orderId: string
  shopId: string
  restaurantId: string
  orderNumber: string | null
  orderClientChannel: OrderClientChannel | null
  customerProfileId: string | null
  customerTelegramId: number | null
  customerMaxUserId: string | null
  customerMaxConversationId: string | null
  customerPhone: string
  restaurantName: string
}

export async function loadOrderCustomerContact(
  event: H3Event,
  orderId: string,
  options?: { includePhone?: boolean },
): Promise<OrderCustomerContact | null> {
  const includePhone = options?.includePhone === true
  const client = await serverSupabaseServiceRole(event)
  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,order_number,customer_telegram_id,customer_profile_id,order_client_channel')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) {
    console.error('loadOrderCustomerContact order query:', orderError)
  }
  if (!order) return null

  const shopId = String((order as any).shop_id)
  const restaurantId = String((order as any).restaurant_id || '')
  const customerProfileId =
    typeof (order as any).customer_profile_id === 'string' && (order as any).customer_profile_id.trim()
      ? String((order as any).customer_profile_id).trim()
      : null

  let customerMaxUserId: string | null = null
  let customerMaxConversationId: string | null = null
  let customerPhone = ''

  if (customerProfileId) {
    if (includePhone) {
      try {
        customerPhone = await getProfilePhone(client as any, customerProfileId)
      } catch (err) {
        console.error('loadOrderCustomerContact getProfilePhone:', err)
      }
    }
    try {
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('max_user_id,max_conversation_id,telegram_id')
        .eq('id', customerProfileId)
        .maybeSingle()
      if (profileError) {
        console.error('loadOrderCustomerContact profile query:', profileError)
      } else {
        const rawMax = (profile as any)?.max_user_id
        const rawConv = (profile as any)?.max_conversation_id
        customerMaxUserId = typeof rawMax === 'string' && rawMax.trim() ? rawMax.trim() : null
        customerMaxConversationId = typeof rawConv === 'string' && rawConv.trim() ? rawConv.trim() : null
      }
    } catch (err) {
      console.error('loadOrderCustomerContact profile load:', err)
    }
  }

  const tgRaw = Number((order as any).customer_telegram_id)
  const customerTelegramId =
    Number.isFinite(tgRaw) && tgRaw > 0 ? Math.floor(tgRaw) : null

  const { data: restaurant } = restaurantId
    ? await client.from('restaurants').select('name').eq('id', restaurantId).maybeSingle()
    : { data: null as any }

  const channelRaw = String((order as any).order_client_channel || '').trim().toLowerCase()
  const orderClientChannel: OrderClientChannel | null =
    channelRaw === 'telegram_mini' || channelRaw === 'max_mini' || channelRaw === 'web'
      ? channelRaw
      : null

  return {
    orderId,
    shopId,
    restaurantId,
    orderNumber: typeof (order as any).order_number === 'string' ? (order as any).order_number : null,
    orderClientChannel,
    customerProfileId,
    customerTelegramId,
    customerMaxUserId,
    customerMaxConversationId,
    customerPhone,
    restaurantName: String((restaurant as any)?.name || 'Ресторан'),
  }
}

export function orderContactToKeyboardContext(
  contact: OrderCustomerContact,
  options?: { allowTelegramUserLink?: boolean; maxBotUrl?: string | null },
): ManagerCustomerContactContext {
  return {
    orderId: contact.orderId,
    customerTelegramId: contact.customerTelegramId,
    customerMaxUserId: contact.customerMaxUserId,
    customerPhone: contact.customerPhone || null,
    orderClientChannel: contact.orderClientChannel,
    maxBotUrl: options?.maxBotUrl ?? null,
    allowTelegramUserLink: options?.allowTelegramUserLink === true,
  }
}

export async function requestCustomerContactForOrder(
  event: H3Event,
  contact: OrderCustomerContact,
  options: {
    botToken: string
    maxBaseUrl?: string
    maxToken?: string
  },
): Promise<{ phoneShown: string | null; requestSent: boolean }> {
  const restaurantLabel = contact.restaurantName
  const knownPhone = contact.customerPhone?.trim() || ''
  const contactRequestText = knownPhone
    ? `Менеджер ресторана «${restaurantLabel}» хочет связаться с вами по заказу. Ваш номер уже сохранён: ${knownPhone}.`
    : `Менеджер ресторана «${restaurantLabel}» хочет связаться с вами по заказу. Поделитесь номером телефона?`

  let requestSent = false
  const botToken = options.botToken.trim()

  if (contact.customerTelegramId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: contact.customerTelegramId,
        text: contactRequestText,
        ...(knownPhone
          ? {}
          : {
              reply_markup: {
                keyboard: [[{ text: 'Поделиться номером', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }),
      }),
    }).catch(() => {})
    requestSent = true
  }

  const maxBaseUrl = String(options.maxBaseUrl || '').replace(/\/$/, '')
  const maxToken = String(options.maxToken || '').trim()
  const hasMaxConversation =
    typeof contact.customerMaxConversationId === 'string' && contact.customerMaxConversationId.trim()
  const hasMaxUserId =
    typeof contact.customerMaxUserId === 'string' && contact.customerMaxUserId.trim()
  if ((hasMaxConversation || hasMaxUserId) && maxBaseUrl && maxToken) {
    const attachments = !knownPhone
      ? [{
          type: 'inline_keyboard',
          payload: { buttons: [[{ type: 'request_contact', text: 'Поделиться номером' }]] },
        }]
      : undefined
    const url = hasMaxConversation
      ? `${maxBaseUrl}/messages`
      : `${maxBaseUrl}/messages?user_id=${encodeURIComponent(String(contact.customerMaxUserId))}`
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: maxToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(hasMaxConversation ? { conversationId: contact.customerMaxConversationId } : {}),
        text: contactRequestText,
        ...(attachments ? { attachments } : {}),
      }),
    }).catch(() => {})
    requestSent = true
  }

  return { phoneShown: knownPhone || null, requestSent }
}

export async function handleTelegramOrderContactCallback(
  event: H3Event,
  args: {
    botToken: string
    orderId: string
    managerChatId: string
    callbackQueryId: string
  },
): Promise<{ alertText: string; showAlert: boolean }> {
  const contact = await loadOrderCustomerContact(event, args.orderId, { includePhone: true })
  if (!contact) {
    return { alertText: 'Заказ не найден', showAlert: true }
  }

  if (
    args.managerChatId
    && !(await canManageOrderFromManagerChat(event, contact.shopId, args.managerChatId))
  ) {
    return { alertText: 'Нет доступа к этому заказу', showAlert: true }
  }

  if (contact.customerPhone) {
    return { alertText: `Телефон клиента:\n${contact.customerPhone}`, showAlert: true }
  }

  const config = useRuntimeConfig(event)
  const maxBaseUrl = String((config as any).maxApiBaseUrl || '')
  const maxToken = String((config as any).maxApiToken || '')

  const { requestSent } = await requestCustomerContactForOrder(event, contact, {
    botToken: args.botToken,
    maxBaseUrl,
    maxToken,
  })

  if (!requestSent) {
    const hint = formatManagerCustomerLine(orderContactToKeyboardContext(contact))
    return {
      alertText: `Не удалось отправить запрос контакта.\n${hint}`,
      showAlert: true,
    }
  }

  const channelHint =
    contact.orderClientChannel === 'max_mini'
      ? 'Клиент оформил заказ в MAX — запрос отправлен в MAX.'
      : contact.orderClientChannel === 'telegram_mini'
        ? 'Запрос отправлен клиенту в Telegram.'
        : 'Запрос контакта отправлен клиенту.'

  return { alertText: channelHint, showAlert: false }
}

export async function enrichManagerKeyboardFromOrder(
  event: H3Event,
  base: ManagerKeyboardBase,
) {
  const config = useRuntimeConfig(event)
  const maxBotUrl = String((config.public as any)?.maxBotUrl || '').trim()
  const contact = await loadOrderCustomerContact(event, base.orderId)
  const ctx = contact
    ? orderContactToKeyboardContext(contact, {
        maxBotUrl,
        allowTelegramUserLink: base.allowTelegramUserLink === true,
      })
    : null

  return {
    orderId: base.orderId,
    fulfillmentType: base.fulfillmentType,
    orderStatus: base.orderStatus,
    customerTelegramId: ctx?.customerTelegramId ?? null,
    customerMaxUserId: ctx?.customerMaxUserId ?? null,
    customerPhone: ctx?.customerPhone ?? null,
    orderClientChannel: ctx?.orderClientChannel ?? null,
    maxBotUrl,
    allowTelegramUserLink: base.allowTelegramUserLink === true,
    dashboardOrderUrl: base.dashboardOrderUrl,
    etaButtonsEnabled: base.etaButtonsEnabled,
    etaPresets: base.etaPresets,
    branchPickerEnabled: base.branchPickerEnabled,
  }
}

export { formatManagerCustomerLine, buildOrderContactCallback }
