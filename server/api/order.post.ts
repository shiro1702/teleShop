// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — типы Node могут быть не подключены в проекте
import crypto from 'node:crypto'
import { MOCK_PRODUCTS } from '../../data/products'
import type { DeliveryZoneProperties } from '../../utils/deliveryZones'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

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

type PaymentMethod = 'cash' | 'card_courier' | 'online'

function formatPaymentMethod(method: PaymentMethod | undefined): string {
  if (method === 'card_courier') return 'Картой курьеру'
  if (method === 'online') return 'Онлайн (на сайте)'
  return 'Наличными курьеру'
}

function buildOrderMessage(
  orderId: string,
  items: CartItemPayload[],
  total: number,
  deliveryCost: number,
  deliveryZone: DeliveryZoneProperties | null,
  user: TelegramUser,
  options: {
    addressLine?: string | null
    flat?: string | null
    comment?: string | null
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
  },
): string {
  const username = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`
  const grandTotal = total + deliveryCost
  const lines: string[] = [
    `📦 Заказ #${orderId}`,
    '',
    'Состав:',
    ...items.map((item) => `  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`),
    '',
    `💰 Товары: ${formatPrice(total)}`,
    `🚚 Доставка: ${formatPrice(deliveryCost)}${deliveryZone?.name ? ` (зона: ${deliveryZone.name})` : ''}`,
    `💳 Итого с доставкой: ${formatPrice(grandTotal)}`,
    '',
  ]

  if (options.addressLine) {
    const addrParts = [options.addressLine]
    if (options.flat) addrParts.push(options.flat)
    lines.push(`📍 Адрес: ${addrParts.join(', ')}`)
  }
  if (options.comment) {
    lines.push(`📝 Комментарий: ${options.comment}`)
  }

  lines.push(`💳 Оплата: ${formatPaymentMethod(options.paymentMethod)}`)
  if (options.paymentMethod === 'cash' && typeof options.changeFrom === 'number' && options.changeFrom > 0) {
    lines.push(`💵 Сдача с: ${formatPrice(options.changeFrom)}`)
  }

  lines.push(
    '',
    `👤 Клиент: ${username}`,
    `🆔 Telegram ID: ${user.id}`,
  )
  return lines.join('\n')
}

function buildClientOrderMessage(
  orderId: string,
  items: CartItemPayload[],
  total: number,
  deliveryCost: number,
  deliveryZone: DeliveryZoneProperties | null,
  options: {
    addressLine?: string | null
    flat?: string | null
    comment?: string | null
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
  },
): string {
  const grandTotal = total + deliveryCost
  const lines: string[] = [
    `🧾 Ваш заказ #${orderId} принят!`,
    '',
    'Состав заказа:',
    ...items.map((item) => `  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`),
    '',
    `💰 Товары: ${formatPrice(total)}`,
    `🚚 Доставка: ${formatPrice(deliveryCost)}${deliveryZone?.name ? ` (зона: ${deliveryZone.name})` : ''}`,
  ]

  if (options.addressLine) {
    const addrParts = [options.addressLine]
    if (options.flat) addrParts.push(options.flat)
    lines.push(`📍 Адрес: ${addrParts.join(', ')}`)
  }
  if (options.comment) {
    lines.push(`📝 Комментарий: ${options.comment}`)
  }

  lines.push(`💳 Способ оплаты: ${formatPaymentMethod(options.paymentMethod)}`)
  if (options.paymentMethod === 'cash' && typeof options.changeFrom === 'number' && options.changeFrom > 0) {
    lines.push(`💵 Вы указали сдачу с: ${formatPrice(options.changeFrom)}`)
  }

  lines.push(
    '',
    'Мы будем присылать сюда обновления статуса: приготовление, передача курьеру и доставка 🚚🍣🍱',
  )
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.botToken as string
  const managerChatId = config.managerChatId as string

  if (!botToken || !managerChatId) {
    throw createError({ statusCode: 500, message: 'Server config: bot token or manager chat ID missing' })
  }

  const body = await readBody<{
    items: CartItemPayload[]
    initData?: string | null
    address?: {
      line?: string | null
      flat?: string | null
      comment?: string | null
      zone?: DeliveryZoneProperties | null
    } | null
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
  } | null>(event)
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

  const deliveryZone: DeliveryZoneProperties | null = body.address?.zone ?? null
  let deliveryCost = 0
  if (!deliveryZone) {
    deliveryCost = itemsWithServerPrice.length ? 200 : 0
  } else if (total >= deliveryZone.freeDeliveryThreshold) {
    deliveryCost = 0
  } else {
    deliveryCost = deliveryZone.deliveryCost
  }

  const addressLine = body.address?.line?.trim() || null
  const flat = body.address?.flat?.trim() || null
  const comment = body.address?.comment?.trim() || null
  const paymentMethod: PaymentMethod = body.paymentMethod || 'cash'
  const changeFrom =
    typeof body.changeFrom === 'number' && Number.isFinite(body.changeFrom) && body.changeFrom > 0
      ? Math.floor(body.changeFrom)
      : null

  // Определяем пользователя: либо через initData (TMA), либо через Supabase-сессию (WEB)
  let user: TelegramUser | null = null
  if (body.initData && typeof body.initData === 'string') {
    // Telegram Mini App: авторизация через initData
    user = validateInitData(body.initData, botToken)
    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid initData' })
    }
  } else {
    // Веб-режим: авторизация через Supabase-сессию и profiles.telegram_id
    const supabaseUser = await serverSupabaseUser(event)
    if (!supabaseUser) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    // В Supabase JWT id может лежать в поле sub, а не id.
    const rawUser = supabaseUser as any
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null

    if (!userId) {
      console.error('Supabase user has invalid id/sub in order (WEB):', supabaseUser)
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    const serviceClient = await serverSupabaseServiceRole(event)

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('telegram_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Error querying profile for order (WEB):', profileError)
      throw createError({ statusCode: 500, message: 'Failed to read profile' })
    }

    if (!profile || profile.telegram_id == null) {
      // Пользователь авторизован в Supabase, но Telegram еще не привязан
      throw createError({ statusCode: 409, message: 'Telegram not linked' })
    }

    user = {
      id: profile.telegram_id as number,
    }
  }

  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '')
  const orderId = `${datePart}-${timePart}`
  const text = buildOrderMessage(orderId, itemsWithServerPrice, total, deliveryCost, deliveryZone, user, {
    addressLine,
    flat,
    comment,
    paymentMethod,
    changeFrom,
  })

  const callbackData = `work_${user.id}_${orderId}`
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — Buffer может быть не типизирован без @types/node
  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    throw createError({ statusCode: 500, message: 'callback_data too long' })
  }

  const payload: any = {
    chat_id: managerChatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принять в работу', callback_data: callbackData },
          { text: '⏱ Задержка (кухня)', callback_data: `delayWork_${user.id}_${orderId}` },
        ],
        [
          { text: '✉️ Написать клиенту', url: `tg://user?id=${user.id}` },
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
    const clientPayload: any = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.id,
        text: buildClientOrderMessage(orderId, itemsWithServerPrice, total, deliveryCost, deliveryZone, {
          addressLine,
          flat,
          comment,
          paymentMethod,
          changeFrom,
        }),
      }),
    }

    // Кнопка "написать менеджеру" ведёт в чат с ботом
    const config = useRuntimeConfig()
    const telegramBotName = (config.public?.telegramBotName as string | undefined) || ''
    if (telegramBotName) {
      const payloadBody = JSON.parse(clientPayload.body as string)
      payloadBody.reply_markup = {
        inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: `https://t.me/${telegramBotName}` }]],
      }
      clientPayload.body = JSON.stringify(payloadBody)
    }

    await fetch(url, clientPayload)
  } catch (notifyErr) {
    console.error('Telegram notify client error:', notifyErr)
  }

  return { ok: true, orderId }
})
