import type { DashboardOrderStatus } from '~/utils/dashboardOrderStatus'
import { isDeliveryFulfillment } from '~/utils/dashboardOrderStatus'

/** Telegram callback_data max 64 bytes; use index + full UUID: `br3__<uuid>`. */
export const BRANCH_MENU_CALLBACK_PREFIX = 'brmenu__'
export const BRANCH_CANCEL_CALLBACK_PREFIX = 'brcancel__'
export const BRANCH_PICK_CALLBACK_RE = /^br(\d+)__(.+)$/
export const ORDER_CONTACT_CALLBACK_PREFIX = 'orderContact__'

export type OrderClientChannel = 'telegram_mini' | 'max_mini' | 'web'

export function buildOrderContactCallback(orderId: string): string {
  return `${ORDER_CONTACT_CALLBACK_PREFIX}${orderId}`
}

export function parseOrderContactCallback(data: string): { orderId: string } | null {
  const trimmed = data.trim()
  if (!trimmed.startsWith(ORDER_CONTACT_CALLBACK_PREFIX)) return null
  const orderId = trimmed.slice(ORDER_CONTACT_CALLBACK_PREFIX.length).trim()
  return orderId ? { orderId } : null
}

export type ShopBranchRow = {
  id: string
  name: string
  address: string | null
  managerGroupChatId: string | null
}

export type ParsedBranchCallback =
  | { kind: 'menu'; orderId: string }
  | { kind: 'cancel'; orderId: string }
  | { kind: 'pick'; branchIndex: number; orderId: string }

export function buildBranchMenuCallback(orderId: string): string {
  return `${BRANCH_MENU_CALLBACK_PREFIX}${orderId}`
}

export function buildBranchCancelCallback(orderId: string): string {
  return `${BRANCH_CANCEL_CALLBACK_PREFIX}${orderId}`
}

export function buildBranchPickCallback(branchIndex: number, orderId: string): string {
  return `br${branchIndex}__${orderId}`
}

export function parseBranchCallback(data: string): ParsedBranchCallback | null {
  const trimmed = data.trim()
  if (trimmed.startsWith(BRANCH_MENU_CALLBACK_PREFIX)) {
    const orderId = trimmed.slice(BRANCH_MENU_CALLBACK_PREFIX.length).trim()
    return orderId ? { kind: 'menu', orderId } : null
  }
  if (trimmed.startsWith(BRANCH_CANCEL_CALLBACK_PREFIX)) {
    const orderId = trimmed.slice(BRANCH_CANCEL_CALLBACK_PREFIX.length).trim()
    return orderId ? { kind: 'cancel', orderId } : null
  }
  const pick = BRANCH_PICK_CALLBACK_RE.exec(trimmed)
  if (pick) {
    const branchIndex = Number(pick[1])
    const orderId = pick[2]?.trim()
    if (!orderId || !Number.isFinite(branchIndex) || branchIndex < 0 || branchIndex > 99) return null
    return { kind: 'pick', branchIndex: Math.floor(branchIndex), orderId }
  }
  return null
}

export const CUSTOMER_VISIBLE_ORDER_STATUSES = new Set<DashboardOrderStatus>([
  'in_progress',
  'ready_for_pickup',
  'out_for_delivery',
  'handed_to_customer',
  'cancelled',
])

export function shouldNotifyCustomerOfStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase() as DashboardOrderStatus
  return CUSTOMER_VISIBLE_ORDER_STATUSES.has(normalized)
}

export type ManagerCustomerContactContext = {
  orderId: string
  customerTelegramId?: number | null
  customerMaxUserId?: string | null
  customerPhone?: string | null
  orderClientChannel?: OrderClientChannel | null
  maxBotUrl?: string | null
  /** tg://user допустим только в личке менеджера, не в группе. */
  allowTelegramUserLink?: boolean
}

export function formatManagerCustomerLine(ctx: ManagerCustomerContactContext): string {
  const phone = typeof ctx.customerPhone === 'string' ? ctx.customerPhone.trim() : ''
  const channel =
    ctx.orderClientChannel === 'max_mini'
      ? 'MAX'
      : ctx.orderClientChannel === 'telegram_mini'
        ? 'Telegram'
        : ctx.orderClientChannel === 'web'
          ? 'Сайт'
          : null
  const idPart = ctx.customerMaxUserId
    ? `id:${ctx.customerMaxUserId}`
    : ctx.customerTelegramId && ctx.customerTelegramId > 0
      ? `id:${ctx.customerTelegramId}`
      : null
  if (phone && channel && idPart) return `${phone} • ${channel} ${idPart}`
  if (phone && idPart) return `${phone} • ${idPart}`
  if (phone) return phone
  if (channel && idPart) return `${channel} ${idPart}`
  if (idPart) return idPart
  return 'контакт уточняется'
}

function buildMaxManagerContactUrl(maxBotUrl: string, orderId: string): string | null {
  const base = maxBotUrl.trim()
  if (!base) return null
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}start=${encodeURIComponent(`ordercontact_${orderId}`)}`
}

function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim()
  return trimmed.startsWith('https://') || trimmed.startsWith('http://')
}

export function appendManagerContactButtons(
  rows: Array<Array<Record<string, string>>>,
  ctx: ManagerCustomerContactContext,
): void {
  const phone = typeof ctx.customerPhone === 'string' ? ctx.customerPhone.trim() : ''
  const isMaxClient = ctx.orderClientChannel === 'max_mini'
  const contactLabel = phone
    ? '📞 Позвонить'
    : isMaxClient
      ? '📞 Связаться (MAX)'
      : '📞 Запросить номер'

  rows.push([{ text: contactLabel, callback_data: buildOrderContactCallback(ctx.orderId) }])

  const linkRow: Array<Record<string, string>> = []
  if (isMaxClient && ctx.maxBotUrl && isValidHttpUrl(ctx.maxBotUrl)) {
    const maxUrl = buildMaxManagerContactUrl(ctx.maxBotUrl, ctx.orderId)
    if (maxUrl && isValidHttpUrl(maxUrl)) {
      linkRow.push({ text: '💬 Открыть MAX', url: maxUrl })
    }
  }

  if (
    ctx.allowTelegramUserLink
    && ctx.customerTelegramId
    && Number.isFinite(ctx.customerTelegramId)
    && ctx.customerTelegramId > 0
  ) {
    linkRow.push({ text: '✉️ Telegram', url: `tg://user?id=${ctx.customerTelegramId}` })
  }

  if (linkRow.length) rows.push(linkRow)
}

type ManagerKeyboardOptions = {
  orderId: string
  fulfillmentType: string
  orderStatus: string
  customerTelegramId?: number | null
  customerMaxUserId?: string | null
  customerPhone?: string | null
  orderClientChannel?: OrderClientChannel | null
  maxBotUrl?: string | null
  allowTelegramUserLink?: boolean
  dashboardOrderUrl?: string
  etaButtonsEnabled?: boolean
  etaPresets?: number[]
  branchPickerEnabled?: boolean
}

export function buildManagerOrderInlineKeyboard(options: ManagerKeyboardOptions): {
  inline_keyboard: Array<Array<Record<string, string>>>
} {
  const {
    orderId,
    fulfillmentType,
    orderStatus,
    customerTelegramId,
    customerMaxUserId,
    customerPhone,
    orderClientChannel,
    maxBotUrl,
    allowTelegramUserLink = false,
    dashboardOrderUrl,
    etaButtonsEnabled,
    etaPresets = [],
    branchPickerEnabled = false,
  } = options
  const delivery = isDeliveryFulfillment(fulfillmentType)
  const status = (orderStatus || 'new').toLowerCase()
  const rows: Array<Array<Record<string, string>>> = []

  const contactRows: Array<Array<Record<string, string>>> = []
  appendManagerContactButtons(contactRows, {
    orderId,
    customerTelegramId,
    customerMaxUserId,
    customerPhone,
    orderClientChannel,
    maxBotUrl,
    allowTelegramUserLink,
  })
  if (dashboardOrderUrl && isValidHttpUrl(dashboardOrderUrl)) {
    contactRows.push([{ text: '📋 Открыть заказ', url: dashboardOrderUrl }])
  }

  if (branchPickerEnabled) {
    rows.push([{ text: '🏪 Сменить филиал', callback_data: buildBranchMenuCallback(orderId) }])
  }

  if (status === 'new' || status === 'in_progress' || status === 'ready_for_pickup' || status === 'out_for_delivery') {
    if (status === 'new') {
      rows.push([
        { text: '👨‍🍳 Принять в работу', callback_data: `work__${orderId}` },
        { text: '⏱ Задержка (кухня)', callback_data: `delayWork__${orderId}` },
      ])
      if (etaButtonsEnabled && etaPresets.length) {
        rows.push(
          etaPresets.slice(0, 4).map((mins) => ({
            text: `⌛ ${mins} мин`,
            callback_data: `etaWork_${mins}_${orderId}`,
          })),
        )
      }
    } else if (status === 'in_progress') {
      if (delivery) {
        rows.push([
          { text: '🚚 Передать курьеру', callback_data: `courier__${orderId}` },
          { text: '⏱ Задержка (кухня)', callback_data: `delayWork__${orderId}` },
        ])
      } else {
        rows.push([
          { text: '📦 Готов к выдаче', callback_data: `pickup__${orderId}` },
          { text: '⏱ Задержка (кухня)', callback_data: `delayWork__${orderId}` },
        ])
      }
    } else if (status === 'ready_for_pickup') {
      rows.push([{ text: '✅ Выдан клиенту', callback_data: `done__${orderId}` }])
    } else if (status === 'out_for_delivery') {
      rows.push([
        { text: '✅ Доставлен', callback_data: `done__${orderId}` },
        { text: '⏱ Задержка (доставка)', callback_data: `delayCourier__${orderId}` },
      ])
    }
  }

  if (contactRows.length) rows.push(...contactRows)
  return { inline_keyboard: rows.filter((row) => row.length > 0) }
}

/** Подпись кнопки филиала в меню смены (лимит Telegram — 64 символа). */
export function buildOrderTransferredNoticeText(orderRef: string, targetBranchName: string): string {
  return [
    `🔀 Заказ ${orderRef} перенесён на филиал «${targetBranchName}»`,
    'Карточка заказа и кнопки управления — в чате назначенного филиала.',
  ].join('\n')
}

export function formatBranchPickerButtonLabel(branchName: string, isCurrent: boolean): string {
  const raw = branchName.trim() || '—'
  const maxLen = isCurrent ? 28 : 32
  const truncated = raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw
  return isCurrent ? `✓ ${truncated} (сейчас)` : truncated
}

export function buildBranchPickerInlineKeyboard(
  branches: ShopBranchRow[],
  orderId: string,
  currentBranchId?: string | null,
): { inline_keyboard: Array<Array<Record<string, string>>> } {
  const currentId = typeof currentBranchId === 'string' ? currentBranchId.trim() : ''
  const rows: Array<Array<Record<string, string>>> = []
  let row: Array<Record<string, string>> = []
  branches.forEach((branch, index) => {
    const isCurrent = Boolean(currentId && branch.id === currentId)
    const label = formatBranchPickerButtonLabel(branch.name, isCurrent)
    row.push({ text: label, callback_data: buildBranchPickCallback(index, orderId) })
    if (row.length >= 2) {
      rows.push(row)
      row = []
    }
  })
  if (row.length) rows.push(row)
  rows.push([{ text: '↩️ Назад', callback_data: buildBranchCancelCallback(orderId) }])
  return { inline_keyboard: rows }
}

export function updateManagerMessageBranchLines(
  text: string,
  args: { brandName: string; branchName: string; branchAddress: string; cityName: string },
): string {
  const branchAddress = args.branchAddress || 'Адрес не указан'
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('🏪 ') && trimmed.includes('•')) {
        return `🏪 ${args.brandName} • ${args.branchName}`
      }
      if (trimmed.startsWith('📍 ') && !trimmed.startsWith('📍 Адрес филиала:')) {
        return `📍 ${branchAddress}, ${args.cityName}`
      }
      if (trimmed.startsWith('🏪 Филиал:')) return `🏪 Филиал: ${args.branchName}`
      if (trimmed.startsWith('📍 Адрес филиала:')) return `📍 Адрес филиала: ${branchAddress}`
      return line
    })
    .join('\n')
}

export type ChatFlowOrderStatus = 'in_progress' | 'ready_for_pickup' | 'out_for_delivery' | 'handed_to_customer'

export function mapChatCallbackToOrderStatus(
  callbackStatus: 'work' | 'courier' | 'pickup' | 'done',
): ChatFlowOrderStatus {
  if (callbackStatus === 'work') return 'in_progress'
  if (callbackStatus === 'courier') return 'out_for_delivery'
  if (callbackStatus === 'pickup') return 'ready_for_pickup'
  return 'handed_to_customer'
}

export function buildCustomerStatusShortText(orderRef: string, status: DashboardOrderStatus, fulfillmentType: string): string | null {
  if (!shouldNotifyCustomerOfStatus(status)) return null
  const delivery = isDeliveryFulfillment(fulfillmentType)
  if (status === 'in_progress') {
    return `👨‍🍳 Ваш заказ ${orderRef} принят в работу. Кухня уже готовит ваш заказ.`
  }
  if (status === 'ready_for_pickup') {
    return `📦 Ваш заказ ${orderRef} готов к выдаче. Можно забирать.`
  }
  if (status === 'out_for_delivery') {
    return `🚚 Ваш заказ ${orderRef} передан курьеру и уже в пути.`
  }
  if (status === 'handed_to_customer') {
    return delivery
      ? `✅ Ваш заказ ${orderRef} доставлен. Спасибо, что выбрали нас! Приятного аппетита 🥘🍣🍜`
      : `✅ Ваш заказ ${orderRef} выдан. Спасибо, что выбрали нас! Приятного аппетита 🥘🍣🍜`
  }
  if (status === 'cancelled') {
    return `❌ Заказ ${orderRef} отменён. Если это ошибка — напишите нам.`
  }
  return null
}
