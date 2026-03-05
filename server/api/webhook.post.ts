const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

async function telegram(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telegram ${method}: ${res.status} ${text}`)
  }
  return res.json()
}

function parseCallbackData(data: string): { status: string; userId: string; orderId: string } | null {
  const parts = data.split('_')
  if (parts.length !== 3) return null
  const [status, userId, orderId] = parts
  if (!status || !userId || !orderId) return null
  return { status, userId, orderId }
}

const CLIENT_MESSAGES: Record<string, (orderId: string) => string> = {
  work: (orderId) => `Ваш заказ #${orderId} принят в работу.`,
  courier: (orderId) => `Заказ #${orderId} передан курьеру.`,
  done: (orderId) => `Заказ #${orderId} доставлен. Спасибо!`,
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.botToken as string
  const managerChatId = config.managerChatId as string
  const appUrl = (config.appUrl as string) || ''

  if (!botToken || !managerChatId) {
    throw createError({ statusCode: 500, message: 'Server config: bot token or manager chat ID missing' })
  }

  const body = await readBody<{
    message?: { text?: string; chat?: { id: number } }
    callback_query?: {
      id: string
      from: { id: number }
      message?: { chat: { id: number }; message_id: number; text?: string }
      data?: string
    }
  }>(event)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Expected Telegram update body' })
  }

  // Команда /start — приветствие и кнопка Web App
  if (body.message?.text) {
    const chatId = body.message.chat?.id
    if (chatId === undefined) return { ok: true }

    const text = (body.message.text || '').trim()
    if (text === '/start') {
      const replyMarkup = appUrl
        ? {
            inline_keyboard: [[{ text: 'Открыть магазин', web_app: { url: appUrl } }]],
          }
        : undefined
      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть магазин.',
        reply_markup: replyMarkup,
      })
      return { ok: true }
    }
    if (text === '/help') {
      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: 'Поддержка: свяжитесь с нами в чате или по контактам, указанным в описании бота.',
      })
      return { ok: true }
    }
    return { ok: true }
  }

  // Нажатие inline-кнопки менеджером (callback_query)
  const query = body.callback_query
  if (!query?.data || !query.message) {
    return { ok: true }
  }

  const parsed = parseCallbackData(query.data)
  if (!parsed || !['work', 'courier', 'done'].includes(parsed.status)) {
    await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
    return { ok: true }
  }

  const { status, userId, orderId } = parsed
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const currentText = query.message.text || ''

  // Уведомление клиенту
  const clientText = CLIENT_MESSAGES[status]?.(orderId)
  if (clientText) {
    await telegram(botToken, 'sendMessage', {
      chat_id: Number(userId),
      text: clientText,
    }).catch((err) => console.error('Notify client error:', err))
  }

  // Обновление сообщения у менеджера через editMessageText
  if (status === 'work') {
    const nextData = `courier_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: currentText,
      reply_markup: { inline_keyboard: [[{ text: 'Передать курьеру', callback_data: nextData }]] },
    })
  } else if (status === 'courier') {
    const nextData = `done_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: currentText,
      reply_markup: { inline_keyboard: [[{ text: 'Доставлен', callback_data: nextData }]] },
    })
  } else {
    // done — кнопки убираем, остаётся текст "Заказ завершен"
    const finalText = `${currentText}\n\n✅ Заказ завершен`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: finalText,
      reply_markup: { inline_keyboard: [] },
    })
  }

  await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
  return { ok: true }
})
