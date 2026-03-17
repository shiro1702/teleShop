import { randomUUID } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'

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

type CallbackKind = 'status' | 'delay'

function parseCallbackData(
  data: string,
): { kind: CallbackKind; status: 'work' | 'courier' | 'done'; userId: string; orderId: string } | null {
  const parts = data.split('_')
  if (parts.length !== 3) return null
  const [rawStatus, userId, orderId] = parts
  if (!rawStatus || !userId || !orderId) return null

  // Обычные статусы
  if (rawStatus === 'work' || rawStatus === 'courier' || rawStatus === 'done') {
    return { kind: 'status', status: rawStatus, userId, orderId }
  }

  // Отдельные callback'и для задержек:
  // delayWork_userId_orderId → задержка на этапе "work"
  // delayCourier_userId_orderId → задержка на этапе "courier"
  if (rawStatus === 'delayWork') {
    return { kind: 'delay', status: 'work', userId, orderId }
  }
  if (rawStatus === 'delayCourier') {
    return { kind: 'delay', status: 'courier', userId, orderId }
  }

  return null
}

const CLIENT_MESSAGES: Record<'work' | 'courier' | 'done', (orderId: string) => string> = {
  work: (orderId) =>
    `👨‍🍳 Ваш заказ #${orderId} принят в работу и сейчас готовится. Мы сообщим, когда он будет передан курьеру.`,
  courier: (orderId) =>
    `🚚 Ваш заказ #${orderId} передан курьеру и уже в пути к вам. Ожидайте, пожалуйста.`,
  done: (orderId) =>
    `✅ Ваш заказ #${orderId} доставлен. Спасибо, что выбрали нас! Приятного аппетита 🥘🍣🍜`,
}

const CLIENT_DELAY_MESSAGES: Record<Exclude<'work' | 'courier' | 'done', 'done'>, (orderId: string) => string> = {
  work: (orderId) =>
    `⏱ Небольшая задержка по заказу #${orderId}: кухня готовит ваше блюдо чуть дольше обычного. Спасибо за ожидание 👨‍🍳👩‍🍳`,
  courier: (orderId) =>
    `⏱ Небольшая задержка по доставке заказа #${orderId}: курьер уже в пути, но может приехать чуть позже. Спасибо за терпение 🚚🚛📦`,
}

function withStatusLine(baseText: string, statusLabel: string): string {
  const lines = baseText.split('\n')
  const filtered = lines.filter((line) => !line.trim().startsWith('Статус заказа:'))
  return `${filtered.join('\n')}\n\n${statusLabel}`
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

  // Команды /start, /login и другие текстовые команды
  if (body.message?.text) {
    const chatId = body.message.chat?.id
    if (chatId === undefined) return { ok: true }

    const text = (body.message.text || '').trim()
    const [commandRaw, paramRaw] = text.split(' ')
    const isStart = commandRaw === '/start' || commandRaw.startsWith('/start@')
    const isLogin = commandRaw === '/login' || commandRaw.startsWith('/login@')

    if (isStart) {
      const startParam = paramRaw || ''

      // Специальный сценарий: старт с параметром для авторизации с возвратом на сайт
      if (startParam === 'auth_link' && appUrl) {
        const supabase = await serverSupabaseServiceRole(event)
        const token = randomUUID()

        const { error } = await supabase
          .from('auth_tokens')
          .insert({
            token,
            telegram_id: chatId,
          })

        if (error) {
          console.error('Error inserting auth token from /start auth_link:', error)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Произошла ошибка при создании ссылки. Попробуйте позже.',
          })
          return { ok: true }
        }

        const baseUrl = appUrl.replace(/\/$/, '')
        // После привязки возвращаем пользователя на оформление заказа
        const redirectPath = '/checkout?step=3'
        const link = `${baseUrl}/link-telegram?token=${token}&redirect=${encodeURIComponent(redirectPath)}`

        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Для привязки вашего Telegram к аккаунту на сайте нажмите кнопку ниже, затем вернитесь на сайт.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Привязать Telegram и вернуться на сайт', url: link }]],
          },
        })
        return { ok: true }
      }

      // Обычный /start без параметров — приветствие и кнопка Web App
      if (!startParam) {
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
    }
    if (isLogin) {
      // Привязка Telegram-аккаунта к аккаунту на сайте через одноразовый токен
      if (!appUrl) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Ссылка для привязки временно недоступна. Попробуйте позже.',
        })
        return { ok: true }
      }

      const supabase = await serverSupabaseServiceRole(event)
      const token = randomUUID()

      const { error } = await supabase
        .from('auth_tokens')
        .insert({
          token,
          telegram_id: chatId,
        })

      if (error) {
        console.error('Error inserting auth token from /login:', error)
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Произошла ошибка при создании ссылки. Попробуйте позже.',
        })
        return { ok: true }
      }

      const baseUrl = appUrl.replace(/\/$/, '')
      const link = `${baseUrl}/link-telegram?token=${token}`

      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: 'Чтобы привязать ваш Telegram к аккаунту на сайте, нажмите кнопку ниже.',
        reply_markup: {
          inline_keyboard: [[{ text: 'Привязать Telegram', url: link }]],
        },
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
  if (!parsed) {
    await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
    return { ok: true }
  }

  const { kind, status, userId, orderId } = parsed
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const currentText = query.message.text || ''

  if (kind === 'delay') {
    const baseStatus: 'work' | 'courier' = status === 'courier' ? 'courier' : 'work'
    const clientDelayText = CLIENT_DELAY_MESSAGES[baseStatus]?.(orderId)
    if (clientDelayText) {
      await telegram(botToken, 'sendMessage', {
        chat_id: Number(userId),
        text: clientDelayText,
      }).catch((err) => console.error('Notify client delay error:', err))
    }

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Информация о задержке отправлена клиенту',
      show_alert: false,
    })
    return { ok: true }
  }

  // kind === 'status'
  const clientText = CLIENT_MESSAGES[status]?.(orderId)
  if (clientText) {
    await telegram(botToken, 'sendMessage', {
      chat_id: Number(userId),
      text: clientText,
    }).catch((err) => console.error('Notify client error:', err))
  }

  let updatedText = currentText
  if (status === 'work') {
    updatedText = withStatusLine(currentText, '🟡 Статус заказа: принят в работу')
    const nextData = `courier_${userId}_${orderId}`
    const delayData = `delayWork_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: updatedText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚚 Передать курьеру', callback_data: nextData },
            { text: '⏱ Задержка (кухня)', callback_data: delayData },
          ],
        ],
      },
    })
  } else if (status === 'courier') {
    updatedText = withStatusLine(currentText, '🟠 Статус заказа: передан курьеру')
    const nextData = `done_${userId}_${orderId}`
    const delayData = `delayCourier_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: updatedText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Доставлен', callback_data: nextData },
            { text: '⏱ Задержка (доставка)', callback_data: delayData },
          ],
        ],
      },
    })
  } else {
    // done — кнопки убираем, добавляем финальный статус
    const finalText = withStatusLine(currentText, '🟢 Статус заказа: доставлен клиенту ✅')
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
