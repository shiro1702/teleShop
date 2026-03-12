// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — типы Node могут быть не подключены в проекте
import crypto from 'node:crypto'
import { MOCK_PRODUCTS } from '../../data/products'
import { getTelegramUserFromEvent } from '../utils/getTelegramUserFromEvent'

interface CartItemPayload {
  id: string
  name: string
  price: number
  quantity: number
}

interface TelegramUser {
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

function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildOrderMessage(orderId: string, items: CartItemPayload[], total: number, user: TelegramUser): string {
  const username = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`
  const lines: string[] = [
    `📦 Заказ #${orderId}`,
    '',
    'Состав:',
    ...items.map((item) => `  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`),
    '',
    `💰 Итого: ${formatPrice(total)}`,
    '',
    `👤 Клиент: ${username}`,
  ]
  return lines.join('\n')
}

function buildClientOrderMessage(orderId: string, items: CartItemPayload[], total: number): string {
  const lines: string[] = [
    `🧾 Ваш заказ #${orderId} принят!`,
    '',
    'Состав заказа:',
    ...items.map((item) => `  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`),
    '',
    `💰 Итого к оплате: ${formatPrice(total)}`,
    '',
    'Мы будем присылать сюда обновления статуса: приготовление, передача курьеру и доставка 🚚🍣🍱',
  ]
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.botToken as string
  const managerChatId = config.managerChatId as string

  if (!botToken || !managerChatId) {
    throw createError({ statusCode: 500, message: 'Server config: bot token or manager chat ID missing' })
  }

  const body = await readBody<{ items: CartItemPayload[]; initData?: string | null } | null>(event)
  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected { items }' })
  }

  // Пересчитываем сумму на сервере по каталогу, не доверяя ценам с клиента
  const itemsWithServerPrice: CartItemPayload[] = body.items.map((item) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === item.id)
    if (!product) {
      throw createError({ statusCode: 400, message: `Unknown product id: ${item.id}` })
    }
    const quantity = item.quantity > 0 ? item.quantity : 0
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
    }
  })

  const total = itemsWithServerPrice.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Определяем пользователя: либо через initData (TMA), либо через сессию (WEB)
  let user: TelegramUser | null = null
  if (body.initData && typeof body.initData === 'string') {
    user = validateInitData(body.initData, botToken)
    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid initData' })
    }
  } else {
    const sessionUser = await getTelegramUserFromEvent(event)
    if (!sessionUser) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    user = {
      id: sessionUser.id,
      username: sessionUser.username,
      first_name: sessionUser.firstName ?? undefined,
      last_name: sessionUser.lastName ?? undefined,
    }
  }

  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '')
  const orderId = `${datePart}-${timePart}`
  const text = buildOrderMessage(orderId, itemsWithServerPrice, total, user)

  const callbackData = `work_${user.id}_${orderId}`
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — Buffer может быть не типизирован без @types/node
  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    throw createError({ statusCode: 500, message: 'callback_data too long' })
  }

  const payload = {
    chat_id: managerChatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принять в работу', callback_data: callbackData },
          { text: '⏱ Задержка (кухня)', callback_data: `delayWork_${user.id}_${orderId}` },
        ],
      ],
    },
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Telegram sendMessage error:', res.status, err)
    throw createError({ statusCode: 502, message: 'Failed to send message to manager' })
  }

  // Дополнительное уведомление клиента о создании заказа (ошибки не критичны)
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.id,
        text: buildClientOrderMessage(orderId, itemsWithServerPrice, total),
      }),
    })
  } catch (notifyErr) {
    console.error('Telegram notify client error:', notifyErr)
  }

  return { ok: true, orderId }
})
