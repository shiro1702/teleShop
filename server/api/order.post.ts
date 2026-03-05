import crypto from 'node:crypto'

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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.botToken as string
  const managerChatId = config.managerChatId as string

  if (!botToken || !managerChatId) {
    throw createError({ statusCode: 500, message: 'Server config: bot token or manager chat ID missing' })
  }

  const body = await readBody<{ items: CartItemPayload[]; initData: string }>(event)
  if (!body?.items?.length || !body?.initData || typeof body.initData !== 'string') {
    throw createError({ statusCode: 400, message: 'Expected { items, initData }' })
  }

  const user = validateInitData(body.initData, botToken)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid initData' })
  }

  const orderId = String(Math.floor(1000 + Math.random() * 9000))
  const total = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const text = buildOrderMessage(orderId, body.items, total, user)

  const callbackData = `work_${user.id}_${orderId}`
  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    throw createError({ statusCode: 500, message: 'callback_data too long' })
  }

  const payload = {
    chat_id: managerChatId,
    text,
    reply_markup: {
      inline_keyboard: [[{ text: 'Принять в работу', callback_data }]],
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

  return { ok: true }
})
