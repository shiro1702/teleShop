import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl } from '~/server/utils/authSiteLink'
import { applyFestivalModerationAction } from '~/server/utils/festivalUgcModeration'
import { createServiceCallEvent, getStaffResponseText, mapActionToStatus } from '~/server/utils/serviceCalls'
import { appendOrderTimelineEntry, applyOrderStatusFromChat, getUnifiedFlowConfig } from '~/server/utils/orderFlowActions'
import {
  assignOrderBranchFromChat,
  buildBranchPickerInlineKeyboard,
  buildManagerOrderInlineKeyboard,
  canManageOrderFromManagerChat,
  loadActiveShopBranches,
  mapChatCallbackToOrderStatus,
  parseBranchCallback,
  parseOrderContactCallback,
  syncTelegramChatsAfterBranchTransfer,
} from '~/server/utils/orderChatFlow'
import type { ChatFlowOrderStatus } from '~/server/utils/orderChatFlowPure'
import { isDeliveryFulfillment } from '~/utils/dashboardOrderStatus'
import { getProfilePhone, normalizePhone, setProfilePhone } from '~/server/utils/accountPhoneLink'
import {
  enrichManagerKeyboardFromOrder,
  handleTelegramOrderContactCallback,
} from '~/server/utils/orderManagerCustomerContact'
import { isShopFeatureEnabled } from '~/server/utils/features'
import { applyReviewPromptTelegramCallback, processDueReviewPrompts } from '~/server/utils/reviewPromptFlow'
import { parseReviewTokenCallback } from '~/server/utils/reviewPromptParse'

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

async function telegram(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const config = useRuntimeConfig()
  const transport = String((config.telegramTransport as string) || 'direct').trim().toLowerCase()
  const relayUrl = String((config.telegramRelayUrl as string) || '').trim()
  const relaySecret = String((config.relaySharedSecret as string) || '').trim()

  const useRelay = transport === 'relay' && !!relayUrl
  const res = useRelay
    ? await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(relaySecret ? { 'x-relay-secret': relaySecret } : {}),
        },
        body: JSON.stringify({
          method,
          payload: body,
          botToken: token,
        }),
      })
    : await fetch(`${TELEGRAM_API(token)}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
  if (!res.ok) {
    const text = await res.text()
    const mode = useRelay ? 'Relay' : 'Telegram'
    throw new Error(`${mode} ${method}: ${res.status} ${text}`)
  }
  return res.json()
}

async function sendMaxMessage(
  baseUrl: string,
  token: string,
  options: { text: string; conversationId?: string | null; userId?: string | null; attachments?: Array<Record<string, unknown>> },
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '')
  const hasConversation = typeof options.conversationId === 'string' && options.conversationId.trim()
  const hasUserId = typeof options.userId === 'string' && options.userId.trim()
  if (!hasConversation && !hasUserId) {
    throw new Error('max_send_target_missing')
  }
  const send = async (mode: 'conversation' | 'user'): Promise<Response> => {
    const url = mode === 'conversation'
      ? `${base}/messages`
      : `${base}/messages?user_id=${encodeURIComponent(String(options.userId))}`
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        ...(mode === 'conversation' ? { conversationId: String(options.conversationId) } : {}),
        ...(Array.isArray(options.attachments) && options.attachments.length ? { attachments: options.attachments } : {}),
      }),
    })
  }

  let res = await send(hasConversation ? 'conversation' : 'user')
  if (!res.ok) {
    const text = await res.text()
    const isUnknownRecipient = res.status === 400 && /unknown recipient|proto\.payload/i.test(text)
    if (hasConversation && hasUserId && isUnknownRecipient) {
      res = await send('user')
      if (!res.ok) {
        const fallbackText = await res.text()
        throw new Error(`MAX sendMessage: ${res.status} ${fallbackText}`)
      }
      return
    }
    throw new Error(`MAX sendMessage: ${res.status} ${text}`)
  }
}

type CallbackKind = 'status' | 'delay'
type ChatLinkTokenRow = {
  token: string
  shop_id: string
  restaurant_id: string
  expires_at: string
  used_at: string | null
}

function formatOrderRef(orderNumber: unknown, fallbackOrderId: string): string {
  const raw = typeof orderNumber === 'string' && orderNumber.trim()
    ? orderNumber.trim()
    : fallbackOrderId.trim()
  const normalized = raw.replace(/\s+/g, '')
  const short = normalized.length > 8 ? normalized.slice(0, 8) : normalized
  return `#${short || '—'}`
}

function parseCallbackData(
  data: string,
): { kind: CallbackKind; status: 'work' | 'courier' | 'pickup' | 'done'; userId: string | null; orderId: string } | null {
  const parts = data.split('_')
  if (parts.length !== 3) return null
  const [rawStatus, userIdRaw, orderId] = parts
  const userId = userIdRaw && userIdRaw.trim() ? userIdRaw.trim() : null
  if (!rawStatus || !orderId) return null

  // Обычные статусы
  if (rawStatus === 'work' || rawStatus === 'courier' || rawStatus === 'pickup' || rawStatus === 'done') {
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

function parseBindToken(text: string): string | null {
  const trimmed = text.trim()
  const [first = '', second = ''] = trimmed.split(/\s+/, 2)
  const command = first.toLowerCase()
  if (command === '/bind' || command.startsWith('/bind@')) {
    return second ? second.trim() : null
  }
  if (command.startsWith('/bind_')) {
    const token = first.slice('/bind_'.length)
    return token ? token.trim() : null
  }
  return null
}

function parseServiceCallbackData(data: string): { action: 'soon' | 'on_my_way' | 'done'; serviceCallId: string } | null {
  const parts = data.split(':')
  if (parts.length !== 3 || parts[0] !== 'svc') return null
  const action = parts[1]
  const serviceCallId = parts[2]?.trim()
  if (!serviceCallId) return null
  if (action !== 'soon' && action !== 'on_my_way' && action !== 'done') return null
  return { action, serviceCallId }
}

function parseServiceContactCallbackData(data: string): { serviceCallId: string } | null {
  const parts = data.split(':')
  if (parts.length !== 3 || parts[0] !== 'svc' || parts[1] !== 'contact') return null
  const serviceCallId = parts[2]?.trim()
  if (!serviceCallId) return null
  return { serviceCallId }
}

const CLIENT_MESSAGES: Record<'work' | 'courier' | 'pickup' | 'done', (orderRef: string) => string> = {
  work: (orderRef) =>
    `👨‍🍳 Ваш заказ ${orderRef} принят в работу. Кухня уже готовит ваш заказ.`,
  courier: (orderRef) =>
    `🚚 Ваш заказ ${orderRef} передан курьеру и уже в пути.`,
  pickup: (orderRef) =>
    `📦 Ваш заказ ${orderRef} готов к выдаче. Можно забирать.`,
  done: (orderRef) =>
    `✅ Ваш заказ ${orderRef} доставлен. Спасибо, что выбрали нас! Приятного аппетита 🥘🍣🍜`,
}

function managerStatusLine(
  status: 'work' | 'courier' | 'pickup' | 'done',
  fulfillmentType: string,
): string {
  if (status === 'work') return '🟡 Статус заказа: принят в работу'
  if (status === 'pickup') return '🟢 Статус заказа: готов к выдаче'
  if (status === 'courier') return '🟠 Статус заказа: передан курьеру'
  return isDeliveryFulfillment(fulfillmentType)
    ? '🟢 Статус заказа: доставлен клиенту ✅'
    : '🟢 Статус заказа: выдан клиенту ✅'
}

const CLIENT_DELAY_MESSAGES: Record<Exclude<'work' | 'courier' | 'done', 'done'>, (orderRef: string) => string> = {
  work: (orderRef) =>
    `⏱ Небольшая задержка по заказу ${orderRef}: кухня готовит ваше блюдо чуть дольше обычного. Спасибо за ожидание 👨‍🍳👩‍🍳`,
  courier: (orderRef) =>
    `⏱ Небольшая задержка по доставке заказа ${orderRef}: курьер уже в пути, но может приехать чуть позже. Спасибо за терпение 🚚🚛📦`,
}

function withStatusLine(baseText: string, statusLabel: string): string {
  const lines = baseText.split('\n')
  const filtered = lines.filter((line) => !line.trim().startsWith('Статус заказа:'))
  return `${filtered.join('\n')}\n\n${statusLabel}`
}

function appendOrderDetails(baseText: string, details: {
  branchName: string
  branchAddress: string
  orderTotal: number
  deliveryCost: number
}): string {
  const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
  return [
    baseText,
    '',
    `🏪 Филиал: ${details.branchName}`,
    `📍 Адрес филиала: ${details.branchAddress}`,
    `💰 Доставка: ${rub(details.deliveryCost)}`,
    `💳 Итого: ${rub(details.orderTotal)}`,
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const relaySecret = String((config.relaySharedSecret as string) || '').trim()
  const isRelayEndpoint = String(event.path || '').startsWith('/api/webhook-relay')
  if (isRelayEndpoint && relaySecret) {
    const providedSecret = String(getHeader(event, 'x-relay-secret') || '').trim()
    if (providedSecret !== relaySecret) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }
  const tenant = event.context.tenant
  const botToken = tenant?.telegramBotToken || (config.botToken as string)
  const maxApiBaseUrl = String((config.maxApiBaseUrl as string) || '').trim()
  const maxApiToken = String((config.maxApiToken as string) || '').trim()
  const maxBotUrl = String((config.public as any)?.maxBotUrl || '').trim()
  const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')
  const defaultCitySlug = (
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'
  )
  const appUrl = tenant?.shop?.custom_domain
    ? `https://${tenant.shop.custom_domain}`
    : tenant?.shop?.slug
      ? `${appUrlBase}/${encodeURIComponent(tenant.shop.slug)}`
      : appUrlBase

  if (!botToken) {
    throw createError({ statusCode: 500, message: 'Server config: bot token missing' })
  }

  try {
  const body = await readBody<{
    message?: {
      text?: string
      chat?: { id: number; type?: string }
      from?: { id?: number }
      contact?: { phone_number?: string; user_id?: number }
    }
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

  /** Ответ контактом после кнопки request_contact (часто без поля text). */
  if (body.message?.contact?.phone_number && body.message.chat?.id !== undefined) {
    const chatId = body.message.chat.id
    const phone = normalizePhone(String(body.message.contact.phone_number || '').trim())
    if (phone) {
      const supabaseContact = await serverSupabaseServiceRole(event)
      const { data: tokenForPhone } = await supabaseContact
        .from('auth_tokens')
        .select('token, bridge_payload')
        .eq('channel', 'telegram')
        .eq('telegram_id', chatId)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tokenForPhone?.token) {
        const prev = ((tokenForPhone as { bridge_payload?: Record<string, unknown> }).bridge_payload ??
          {}) as Record<string, unknown>
        await supabaseContact
          .from('auth_tokens')
          .update({
            bridge_payload: { ...prev, telegram_shared_phone: phone },
          })
          .eq('token', tokenForPhone.token)
        const { data: profile } = await supabaseContact
          .from('profiles')
          .select('id')
          .eq('telegram_id', chatId)
          .maybeSingle()
        if (profile?.id) {
          await setProfilePhone(supabaseContact as any, String(profile.id), phone)
        }
        try {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Номер сохранён. Завершите вход на сайте.',
            reply_markup: { remove_keyboard: true },
          })
        } catch (e) {
          console.error('telegram contact ack:', e)
        }
        return { ok: true }
      }
    }
    return { ok: true }
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
      const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')

      const linkSessionMatch = /^link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
        startParam,
      )
      if (linkSessionMatch && appUrlBase) {
        const tokenUuid = linkSessionMatch[1]
        const supabase = await serverSupabaseServiceRole(event)
        const { data: row, error: fetchErr } = await supabase
          .from('auth_tokens')
          .select('token, telegram_id, expires_at, bridge_payload, channel')
          .eq('token', tokenUuid)
          .maybeSingle()

        if (fetchErr) {
          console.error('link_ session fetch:', fetchErr)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Не удалось проверить ссылку. Попробуйте позже.',
          })
          return { ok: true }
        }

        if (!row || String((row as { channel?: string }).channel || 'telegram') !== 'telegram') {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Ссылка недействительна или устарела. Запросите вход на сайте ещё раз.',
          })
          return { ok: true }
        }

        const expiresAt = new Date(String((row as { expires_at?: string }).expires_at)).getTime()
        if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
          await supabase.from('auth_tokens').delete().eq('token', tokenUuid)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Срок ссылки истёк. Вернитесь на сайт и запросите вход снова.',
          })
          return { ok: true }
        }

        const existingTg = (row as { telegram_id?: number | null }).telegram_id
        if (existingTg != null && existingTg !== chatId) {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Эта ссылка уже была использована в другом Telegram-аккаунте. Запросите новую на сайте.',
          })
          return { ok: true }
        }

        if (existingTg == null) {
          const { data: updated, error: updErr } = await supabase
            .from('auth_tokens')
            .update({ telegram_id: chatId })
            .eq('token', tokenUuid)
            .is('telegram_id', null)
            .select('token')
            .maybeSingle()

          if (updErr) {
            console.error('link_ session update:', updErr)
            await telegram(botToken, 'sendMessage', {
              chat_id: chatId,
              text: 'Не удалось подтвердить вход. Попробуйте позже.',
            })
            return { ok: true }
          }

          if (!updated) {
            const { data: again } = await supabase
              .from('auth_tokens')
              .select('telegram_id')
              .eq('token', tokenUuid)
              .maybeSingle()
            const rid = (again as { telegram_id?: number | null } | null)?.telegram_id
            if (rid != null && rid !== chatId) {
              await telegram(botToken, 'sendMessage', {
                chat_id: chatId,
                text: 'Эта ссылка уже была использована в другом Telegram-аккаунте. Запросите новую на сайте.',
              })
              return { ok: true }
            }
          }
        }

        const phoneFromMessage = normalizePhone(body.message.contact?.phone_number?.trim() || '')
        const baseBridge = ((row as { bridge_payload?: Record<string, unknown> }).bridge_payload ?? null) as
          | Record<string, unknown>
          | null
        const bridgePayload: Record<string, unknown> | null = phoneFromMessage
          ? { ...(baseBridge || {}), telegram_shared_phone: phoneFromMessage }
          : baseBridge
        if (phoneFromMessage) {
          await supabase.from('auth_tokens').update({ bridge_payload: bridgePayload }).eq('token', tokenUuid)
        }

        const link = buildAuthSiteLinkUrl({
          linkPath: 'link-telegram',
          appUrlBase,
          defaultCitySlug,
          token: tokenUuid,
          bridgePayload: bridgePayload ?? null,
          tenantShop: tenant?.shop,
        })

        const replyMarkup = {
          inline_keyboard: [
            [{ text: 'Привязать аккаунт и открыть сайт', url: link }],
            [{ text: 'Скопировать ссылку для браузера', copy_text: { text: link } }],
          ],
        }

        const contactReplyMarkup = {
          keyboard: [[{ text: 'Поделиться номером', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('telegram_id', chatId)
          .maybeSingle()
        const existingPhone = existingProfile?.id
          ? await getProfilePhone(supabase as any, String(existingProfile.id))
          : ''
        const shouldAskForContact = !(phoneFromMessage || existingPhone)

        try {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: [
              '✅ Telegram подтверждён.',
              '',
              'Вернитесь на сайт — вход завершится автоматически. Если страница не обновилась, нажмите кнопку «Привязать аккаунт…» или скопируйте ссылку и откройте её в браузере.',
              '',
              'Следующим сообщением можно отправить номер телефона для заказов — это необязательно.',
            ].join('\n'),
            reply_markup: replyMarkup,
          })
          if (shouldAskForContact) try {
            await telegram(botToken, 'sendMessage', {
              chat_id: chatId,
              text: 'Нажмите кнопку ниже, если хотите сохранить номер для заказов.',
              reply_markup: contactReplyMarkup,
            })
          } catch (e2) {
            console.warn('telegram request_contact keyboard failed:', e2)
          }
        } catch (e) {
          console.warn('sendMessage with copy_text failed, retrying without copy button:', e)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: [
              '✅ Telegram подтверждён.',
              '',
              'Вернитесь на сайт. Если вход не завершился, откройте ссылку:',
              link,
              '',
              'Следующим сообщением можно отправить номер телефона для заказов.',
            ].join('\n'),
            reply_markup: {
              inline_keyboard: [[{ text: 'Открыть сайт для завершения входа', url: link }]],
            },
          })
          if (shouldAskForContact) try {
            await telegram(botToken, 'sendMessage', {
              chat_id: chatId,
              text: 'Нажмите кнопку ниже, если хотите сохранить номер для заказов.',
              reply_markup: contactReplyMarkup,
            })
          } catch (e2) {
            console.warn('telegram request_contact keyboard failed:', e2)
          }
        }
        return { ok: true }
      }

      const startParts = startParam.split('_')
      const startKey = startParts.slice(0, 2).join('_')

      if (startKey === 'linkchat') {
        const token = startParts.slice(1).join('_').trim()
        if (!token) {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Не удалось прочитать токен привязки. Сгенерируйте ссылку заново в кабинете.',
          })
          return { ok: true }
        }
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: [
            'Токен привязки получен.',
            'Теперь добавьте меня в нужную группу менеджеров и отправьте там команду:',
            `/bind ${token}`,
            '',
            'Привязку может завершить только администратор этой группы.',
          ].join('\n'),
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

      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: [
          'Чтобы войти на сайт, откройте магазин в браузере и нажмите «Войти через Telegram».',
          'Сайт создаст одноразовую ссылку — откройте её здесь, в чате с ботом.',
        ].join('\n'),
      })
      return { ok: true }
    }
    if (isLogin) {
      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: [
          'Вход выполняется через сайт.',
          'Откройте магазин в браузере и нажмите «Войти через Telegram» — вам откроется этот бот с готовой ссылкой.',
        ].join('\n'),
      })
      return { ok: true }
    }
    const bindToken = parseBindToken(text)
    if (bindToken) {
      const fromId = body.message.from?.id
      const chatType = (body.message.chat?.type || '').toLowerCase()
      const isGroupChat = chatType === 'group' || chatType === 'supergroup'

      if (!isGroupChat) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Команда /bind работает только в группе. Отправьте её в чате менеджеров.',
        })
        return { ok: true }
      }
      if (!fromId) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Не удалось определить пользователя. Повторите команду позже.',
        })
        return { ok: true }
      }

      const supabase = await serverSupabaseServiceRole(event)
      const { data: tokenRow } = await supabase
        .from('telegram_chat_link_tokens')
        .select('token,shop_id,restaurant_id,expires_at,used_at')
        .eq('token', bindToken)
        .maybeSingle<ChatLinkTokenRow>()

      if (!tokenRow) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Токен привязки не найден. Сгенерируйте новую ссылку в кабинете.',
        })
        return { ok: true }
      }
      if (tokenRow.used_at) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Этот токен уже использован. Сгенерируйте новый в кабинете.',
        })
        return { ok: true }
      }
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Токен истек. Сгенерируйте новый в кабинете.',
        })
        return { ok: true }
      }

      const memberResult = await telegram(botToken, 'getChatMember', {
        chat_id: chatId,
        user_id: fromId,
      }).catch(() => null) as { result?: { status?: string } } | null
      const memberStatus = String(memberResult?.result?.status || '').toLowerCase()
      if (!(memberStatus === 'administrator' || memberStatus === 'creator')) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Только администратор группы может выполнить привязку.',
        })
        return { ok: true }
      }

      const chatIdValue = String(chatId)
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('manager_group_chat_id', chatIdValue)
        .neq('id', tokenRow.restaurant_id)
        .maybeSingle<{ id: string }>()
      if (existingRestaurant?.id) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Этот чат уже привязан к другому ресторану.',
        })
        return { ok: true }
      }

      const { data: updatedRestaurant, error: updateError } = await supabase
        .from('restaurants')
        .update({ manager_group_chat_id: chatIdValue })
        .eq('id', tokenRow.restaurant_id)
        .eq('shop_id', tokenRow.shop_id)
        .select('name')
        .maybeSingle<{ name: string }>()

      if (updateError || !updatedRestaurant) {
        console.error('Bind chat update restaurant failed:', updateError)
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Не удалось сохранить привязку чата. Попробуйте еще раз.',
        })
        return { ok: true }
      }

      await supabase
        .from('telegram_chat_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', bindToken)
        .is('used_at', null)

      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: `Чат успешно привязан к ресторану "${updatedRestaurant.name}".`,
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

  await processDueReviewPrompts(event, { limit: 8 }).catch(() => {})

  const rtParsed = parseReviewTokenCallback(String(query.data))
  if (rtParsed.ok) {
    const shopId = String((tenant as any)?.shopId || '').trim()
    if (!shopId) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Магазин не определён', show_alert: false })
      return { ok: true }
    }
    const feat = await isShopFeatureEnabled(event, shopId, 'reputation_reviews_pro')
    if (!feat) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Модуль отзывов отключён', show_alert: false })
      return { ok: true }
    }
    const fromId = Number(query.from?.id)
    const chatId = Number(query.message.chat.id)
    const messageId = Number(query.message.message_id)
    if (!Number.isFinite(fromId) || !Number.isFinite(chatId) || !Number.isFinite(messageId)) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Некорректный запрос', show_alert: false })
      return { ok: true }
    }
    try {
      if (rtParsed.action === 'edit') {
        await applyReviewPromptTelegramCallback(event, {
          shopId,
          botToken,
          telegramUserId: fromId,
          chatId,
          messageId,
          token: rtParsed.token,
          action: 'edit',
        })
      } else {
        await applyReviewPromptTelegramCallback(event, {
          shopId,
          botToken,
          telegramUserId: fromId,
          chatId,
          messageId,
          token: rtParsed.token,
          action: 'rate',
          stars: rtParsed.stars,
        })
      }
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: rtParsed.action === 'edit' ? 'Выберите оценку' : 'Спасибо!',
        show_alert: false,
      })
    } catch (e) {
      console.error('review prompt telegram callback:', e)
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Не удалось сохранить оценку',
        show_alert: false,
      })
    }
    return { ok: true }
  }

  if (query.data.startsWith('ugc:')) {
    const parts = query.data.split(':')
    const actionKey = parts[1] || ''
    const submissionId = parts[2] || ''
    if (!submissionId) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Некорректный UGC callback', show_alert: false })
      return { ok: true }
    }
    const mapAction = (): {
      action: 'approve_menu' | 'approve_menu_and_feed' | 'tag_category' | 'forward_to_corner' | 'reject' | 'shadow_ban'
      category?: 'food' | 'stage' | 'vibe' | 'quest' | 'live' | null
      label: string
    } => {
      if (actionKey === 'approve_menu') return { action: 'approve_menu', label: 'Опубликовано в меню' }
      if (actionKey === 'approve_menu_and_feed') return { action: 'approve_menu_and_feed', label: 'Опубликовано в меню и ленте' }
      if (actionKey === 'tag_food') return { action: 'tag_category', category: 'food', label: 'Категория: Еда' }
      if (actionKey === 'tag_stage') return { action: 'tag_category', category: 'stage', label: 'Категория: Сцена' }
      if (actionKey === 'tag_vibe') return { action: 'tag_category', category: 'vibe', label: 'Категория: Вайб' }
      if (actionKey === 'tag_quest') return { action: 'tag_category', category: 'quest', label: 'Категория: Квест' }
      if (actionKey === 'forward') return { action: 'forward_to_corner', label: 'Переслано менеджеру корнера' }
      if (actionKey === 'ban') return { action: 'shadow_ban', label: 'Пользователь отправлен в теневой бан' }
      return { action: 'reject', label: 'Отклонено' }
    }
    const mapped = mapAction()
    try {
      await applyFestivalModerationAction(event, {
        submissionId,
        action: mapped.action,
        category: mapped.category,
        actorChannel: 'telegram',
        actorUserId: String(query.from?.id || ''),
      })
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: mapped.label,
        show_alert: false,
      })
    } catch (err) {
      console.error('webhook ugc moderation failed:', err)
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Не удалось применить действие',
        show_alert: true,
      })
    }
    return { ok: true }
  }

  const orderContactCb = parseOrderContactCallback(query.data)
  if (orderContactCb) {
    const managerChatId = String(query.message?.chat?.id || '')
    const result = await handleTelegramOrderContactCallback(event, {
      botToken,
      orderId: orderContactCb.orderId,
      managerChatId,
      callbackQueryId: query.id,
    })
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: result.alertText,
      show_alert: result.showAlert,
    })
    return { ok: true }
  }

  const serviceCb = parseServiceCallbackData(query.data)
  const serviceContactCb = parseServiceContactCallbackData(query.data)
  if (serviceContactCb) {
    const supabase = await serverSupabaseServiceRole(event)
    const { serviceCallId } = serviceContactCb
    const { data: callRow } = await supabase
      .from('service_calls')
      .select('id,shop_id,restaurant_id,order_id,customer_telegram_id,customer_max_user_id,customer_max_conversation_id,customer_profile_id')
      .eq('id', serviceCallId)
      .maybeSingle()
    if (!callRow) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Запрос не найден', show_alert: false })
      return { ok: true }
    }
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', (callRow as any).restaurant_id)
      .maybeSingle()
    const customerProfileId = typeof (callRow as any).customer_profile_id === 'string'
      ? String((callRow as any).customer_profile_id)
      : ''
    const knownPhone = customerProfileId ? await getProfilePhone(supabase as any, customerProfileId) : ''
    const customerTelegramIdRaw = Number((callRow as any).customer_telegram_id)
    const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0 ? customerTelegramIdRaw : null
    if (customerTelegramId) {
      await telegram(botToken, 'sendMessage', {
        chat_id: customerTelegramId,
        text: knownPhone
          ? `Менеджер ресторана "${String((restaurant as any)?.name || 'Ресторан')}" хочет связаться с вами. Ваш номер уже сохранен: ${knownPhone}.`
          : `Менеджер ресторана "${String((restaurant as any)?.name || 'Ресторан')}" хочет связаться с вами. Поделиться контактом?`,
        ...(knownPhone ? {} : {
          reply_markup: {
            keyboard: [[{ text: 'Поделиться номером', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }),
      }).catch(() => {})
    }
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: knownPhone ? `Номер клиента: ${knownPhone}` : 'Запрос контакта отправлен клиенту',
      show_alert: false,
    })
    return { ok: true }
  }
  if (serviceCb) {
    const supabase = await serverSupabaseServiceRole(event)
    const actorTelegramId = String(query.from?.id || '').trim()
    const { action, serviceCallId } = serviceCb
    if (!actorTelegramId) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Не удалось определить пользователя',
        show_alert: true,
      })
      return { ok: true }
    }

    const { data: callRow } = await supabase
      .from('service_calls')
      .select('id,shop_id,restaurant_id,order_id,customer_telegram_id,customer_max_user_id,customer_max_conversation_id')
      .eq('id', serviceCallId)
      .maybeSingle()
    if (!callRow) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Запрос не найден', show_alert: false })
      return { ok: true }
    }

    const { data: binding } = await supabase
      .from('restaurant_staff_bot_bindings')
      .select('id,display_name')
      .eq('shop_id', (callRow as any).shop_id)
      .eq('restaurant_id', (callRow as any).restaurant_id)
      .eq('channel', 'telegram')
      .eq('external_user_id', actorTelegramId)
      .maybeSingle()

    const nowIso = new Date().toISOString()
    const nextStatus = mapActionToStatus(action)
    const updatePatch: Record<string, unknown> = { status: nextStatus, updated_at: nowIso }
    const { data: callCurrent } = await supabase.from('service_calls').select('first_response_at').eq('id', serviceCallId).maybeSingle()
    if (!(callCurrent as any)?.first_response_at) updatePatch.first_response_at = nowIso
    if (nextStatus === 'resolved') updatePatch.resolved_at = nowIso
    await supabase.from('service_calls').update(updatePatch).eq('id', serviceCallId)

    const actorName = typeof (binding as any).display_name === 'string' && (binding as any).display_name.trim()
      ? String((binding as any).display_name).trim()
      : `Сотрудник ${actorTelegramId}`
    const responseText = getStaffResponseText(action)

    await createServiceCallEvent(event, {
      serviceCallId,
      shopId: String((callRow as any).shop_id),
      restaurantId: String((callRow as any).restaurant_id),
      orderId: (callRow as any).order_id ? String((callRow as any).order_id) : null,
      eventType: 'staff_response',
      eventStatus: nextStatus,
      channel: 'telegram',
      actorBindingId: (binding as any)?.id ? String((binding as any).id) : null,
      actorExternalUserId: actorTelegramId,
      actorDisplayName: actorName,
      message: responseText,
      extraPayload: { action },
    })

    const clientText = `Ответ персонала: ${responseText}`
    const customerTelegramIdRaw = Number((callRow as any).customer_telegram_id)
    const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0 ? customerTelegramIdRaw : null
    if (customerTelegramId) {
      await telegram(botToken, 'sendMessage', { chat_id: customerTelegramId, text: clientText }).catch(() => {})
    }
    const customerMaxUserId = typeof (callRow as any).customer_max_user_id === 'string' ? String((callRow as any).customer_max_user_id).trim() : ''
    const customerMaxConversationId = typeof (callRow as any).customer_max_conversation_id === 'string'
      ? String((callRow as any).customer_max_conversation_id).trim()
      : ''
    if ((customerMaxConversationId || customerMaxUserId) && maxApiBaseUrl && maxApiToken) {
      await sendMaxMessage(maxApiBaseUrl, maxApiToken, {
        conversationId: customerMaxConversationId || undefined,
        userId: customerMaxConversationId ? undefined : customerMaxUserId || undefined,
        text: clientText,
      }).catch(() => {})
    }

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: `Ответ отправлен: ${responseText}`,
      show_alert: false,
    })
    return { ok: true }
  }

  const branchCb = parseBranchCallback(query.data)
  if (branchCb && query.message?.chat?.id != null && query.message?.message_id != null) {
    const chatId = String(query.message.chat.id)
    const messageId = query.message.message_id
    const currentText = query.message.text || ''
    const supabaseBranch = await serverSupabaseServiceRole(event)
    const { data: orderRow } = await supabaseBranch
      .from('orders')
      .select('id,shop_id,restaurant_id,city_id,status,fulfillment_type,order_number,customer_telegram_id')
      .eq('id', branchCb.orderId)
      .maybeSingle()

    if (!orderRow) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Заказ не найден',
        show_alert: false,
      })
      return { ok: true }
    }

    const shopId = String((orderRow as any).shop_id)
    const allowed = await canManageOrderFromManagerChat(event, shopId, chatId)
    if (!allowed) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Нет доступа к этому заказу',
        show_alert: true,
      })
      return { ok: true }
    }

    const appUrlBaseBranch = ((config.appUrl as string) || '').replace(/\/$/, '')
    const dashboardOrderUrlBranch = appUrlBaseBranch
      ? `${appUrlBaseBranch}/dashboard/orders/${encodeURIComponent(branchCb.orderId)}`
      : ''
    const shopBranches = await loadActiveShopBranches(event, shopId)
    const flowConfigBranch = await getUnifiedFlowConfig(event, String((orderRow as any).restaurant_id || ''))

    if (branchCb.kind === 'menu') {
      const currentBranchId = (orderRow as any).restaurant_id ? String((orderRow as any).restaurant_id) : null
      const picker = buildBranchPickerInlineKeyboard(shopBranches, branchCb.orderId, currentBranchId)
      const currentBranchName = currentBranchId
        ? shopBranches.find((b) => b.id === currentBranchId)?.name
        : null
      await telegram(botToken, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: picker,
      })
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: currentBranchName
          ? `Сейчас: ${currentBranchName}. Выберите филиал`
          : 'Выберите филиал',
        show_alert: false,
      })
      return { ok: true }
    }

    if (branchCb.kind === 'cancel') {
      const keyboard = buildManagerOrderInlineKeyboard(
        await enrichManagerKeyboardFromOrder(event, {
          orderId: branchCb.orderId,
          fulfillmentType: String((orderRow as any).fulfillment_type || 'delivery'),
          orderStatus: String((orderRow as any).status || 'new'),
          dashboardOrderUrl: dashboardOrderUrlBranch,
          etaButtonsEnabled: flowConfigBranch.etaButtonsEnabled,
          etaPresets: flowConfigBranch.etaPresets,
          branchPickerEnabled: shopBranches.length > 1,
        }),
      )
      await telegram(botToken, 'editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
      })
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
      return { ok: true }
    }

    const assignResult = await assignOrderBranchFromChat(event, {
      orderId: branchCb.orderId,
      branchIndex: branchCb.branchIndex,
      source: 'telegram',
      actorUserId: String(query.from?.id || ''),
      managerChatId: chatId,
    })

    if (!assignResult.ok) {
      const alertText =
        assignResult.reason === 'same_branch'
          ? 'Заказ уже на этом филиале'
          : assignResult.reason === 'forbidden'
            ? 'Нет доступа'
            : 'Не удалось сменить филиал'
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: alertText,
        show_alert: assignResult.reason !== 'same_branch',
      })
      return { ok: true }
    }

    const cityId = (orderRow as any).city_id ? String((orderRow as any).city_id) : null
    await syncTelegramChatsAfterBranchTransfer(event, {
      botToken,
      shopId,
      orderId: branchCb.orderId,
      cityId,
      previousBranchId: assignResult.previousBranchId,
      newBranchId: assignResult.branchId,
      newBranchName: assignResult.branchName,
      branches: shopBranches,
      actingChatId: chatId,
      actingMessageId: messageId,
    })
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: `Филиал: ${assignResult.branchName}`,
      show_alert: false,
    })
    return { ok: true }
  }

  const parsed = parseCallbackData(query.data)
  const isEtaCallback = query.data.startsWith('etaWork_') || query.data.startsWith('etaCourier_')
  if (isEtaCallback) {
    const [, minsRaw = '', orderIdRaw = ''] = query.data.split('_')
    const orderId = orderIdRaw.trim()
    const mins = Number(minsRaw)
    if (!orderId || !Number.isFinite(mins) || mins <= 0) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Некорректный ETA', show_alert: false })
      return { ok: true }
    }
    const supabase = await serverSupabaseServiceRole(event)
    const { data: order } = await supabase
      .from('orders')
      .select('id,shop_id,restaurant_id,customer_telegram_id')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Заказ не найден', show_alert: false })
      return { ok: true }
    }
    await getUnifiedFlowConfig(event, String((order as any).restaurant_id || ''))
    await appendOrderTimelineEntry(event, {
      orderId,
      shopId: String((order as any).shop_id),
      label: `ETA обновлен из Telegram: ~${Math.floor(mins)} мин`,
      source: 'telegram',
      userId: String(query.from?.id || ''),
      comment: null,
    })
    const customerTelegramId = Number((order as any).customer_telegram_id)
    if (Number.isFinite(customerTelegramId) && customerTelegramId > 0) {
      await telegram(botToken, 'sendMessage', {
        chat_id: customerTelegramId,
        text: `⏱ Обновление по заказу ${formatOrderRef((order as any).order_number, orderId)}: ориентировочно ${Math.floor(mins)} мин.`,
      }).catch(() => {})
    }
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: `ETA: ${Math.floor(mins)} мин`,
      show_alert: false,
    })
    return { ok: true }
  }
  if (query.data.startsWith('clientDelay_')) {
    const orderId = query.data.slice('clientDelay_'.length).trim()
    if (!orderId) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Некорректный сигнал', show_alert: false })
      return { ok: true }
    }
    const supabase = await serverSupabaseServiceRole(event)
    const signalKey = `client_delay_signal:${orderId}:${query.from.id}`
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingSignal } = await supabase
      .from('notification_events')
      .select('id,updated_at')
      .eq('notification_key', signalKey)
      .gte('updated_at', fiveMinutesAgo)
      .maybeSingle()
    if (existingSignal?.id) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Сигнал уже отправлен недавно, повторите чуть позже',
        show_alert: false,
      })
      return { ok: true }
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id,order_number,shop_id,restaurant_id,customer_telegram_id')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Заказ не найден', show_alert: false })
      return { ok: true }
    }
    const { data: branch } = await supabase
      .from('restaurants')
      .select('name,manager_group_chat_id')
      .eq('id', (order as any).restaurant_id)
      .maybeSingle()
    const managerChatId = typeof (branch as any)?.manager_group_chat_id === 'string' ? String((branch as any).manager_group_chat_id).trim() : ''
    if (!managerChatId) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Чат менеджеров не настроен',
        show_alert: true,
      })
      return { ok: true }
    }

    await telegram(botToken, 'sendMessage', {
      chat_id: managerChatId,
      text: [
        '⚠️ Клиент сообщил о задержке',
        `📦 Заказ ${formatOrderRef((order as any).order_number, orderId)}`,
        `🏪 Филиал: ${String((branch as any)?.name || '—')}`,
        `👤 Клиент: id:${query.from.id}`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{ text: '📞 Связаться с клиентом', callback_data: `orderContact__${orderId}` }]],
      },
    })

    await supabase.from('notification_events').upsert({
      notification_key: signalKey,
      event_type: 'ORDER_STATUS_CHANGED',
      channel: 'telegram',
      shop_id: (order as any).shop_id,
      restaurant_id: (order as any).restaurant_id,
      conversation_id: managerChatId,
      delivery_status: 'sent',
      attempt_count: 1,
      payload: { orderId, fromTelegramId: query.from.id, source: 'client_delay_signal' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'notification_key' })

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Сигнал отправлен менеджеру ресторана',
      show_alert: false,
    })
    return { ok: true }
  }
  if (!parsed) {
    await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
    return { ok: true }
  }

  const { kind, status, userId: legacyUserId, orderId } = parsed
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const currentText = query.message.text || ''

  const supabase = await serverSupabaseServiceRole(event)
  const { data: orderDetails } = await supabase
    .from('orders')
    .select('id,shop_id,total,delivery_cost,restaurant_id,status,fulfillment_type,customer_telegram_id,customer_profile_id,order_number')
    .eq('id', orderId)
    .maybeSingle()
  if (!orderDetails) {
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Заказ не найден',
      show_alert: false,
    })
    return { ok: true }
  }
  const managerChatId = String(query.message?.chat?.id || '')
  const orderShopId = String((orderDetails as any).shop_id)
  if (managerChatId && !(await canManageOrderFromManagerChat(event, orderShopId, managerChatId))) {
    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Нет доступа к этому заказу',
      show_alert: true,
    })
    return { ok: true }
  }
  const orderRef = formatOrderRef((orderDetails as any)?.order_number, orderId)
  const flowConfig = await getUnifiedFlowConfig(event, String((orderDetails as any)?.restaurant_id || ''))
  const unifiedFlowEnabled = flowConfig.unifiedOrderFlowEnabled

  const customerProfileId = (orderDetails as any)?.customer_profile_id ? String((orderDetails as any).customer_profile_id) : ''
  let maxUserId: string | null = null
  let maxConversationId: string | null = null
  if (customerProfileId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('max_user_id,max_conversation_id,telegram_id')
      .eq('id', customerProfileId)
      .maybeSingle()
    const rawMaxUserId = (profile as any)?.max_user_id
    const rawConversationId = (profile as any)?.max_conversation_id
    maxUserId = typeof rawMaxUserId === 'string' && rawMaxUserId.trim() ? rawMaxUserId.trim() : null
    maxConversationId = typeof rawConversationId === 'string' && rawConversationId.trim() ? rawConversationId.trim() : null
  }

  const telegramIdFromOrder = Number((orderDetails as any)?.customer_telegram_id)
  const telegramIdFromLegacy = Number(legacyUserId || '')
  const customerTelegramId = Number.isFinite(telegramIdFromOrder) && telegramIdFromOrder > 0
    ? telegramIdFromOrder
    : Number.isFinite(telegramIdFromLegacy) && telegramIdFromLegacy > 0
      ? telegramIdFromLegacy
      : null

  const { data: branch } = (orderDetails as any)?.restaurant_id
    ? await supabase.from('restaurants').select('name,address').eq('id', (orderDetails as any).restaurant_id).maybeSingle()
    : { data: null as any }
  const enrichedText = (base: string) => appendOrderDetails(base, {
    branchName: String((branch as any)?.name || '—'),
    branchAddress: String((branch as any)?.address || '—'),
    orderTotal: Number((orderDetails as any)?.total || 0),
    deliveryCost: Number((orderDetails as any)?.delivery_cost || 0),
  })

  if (kind === 'delay') {
    const baseStatus: 'work' | 'courier' = status === 'courier' ? 'courier' : 'work'
    if (unifiedFlowEnabled) {
      await appendOrderTimelineEntry(event, {
        orderId,
        shopId: String((orderDetails as any).shop_id),
        label: `Сообщение о задержке отправлено клиенту (${baseStatus === 'courier' ? 'доставка' : 'кухня'})`,
        source: 'telegram',
        userId: String(query.from?.id || ''),
        comment: null,
      })
    }
    const clientDelayText = CLIENT_DELAY_MESSAGES[baseStatus]?.(orderRef)
    if (clientDelayText) {
      if (customerTelegramId) {
        await telegram(botToken, 'sendMessage', {
          chat_id: customerTelegramId,
          text: enrichedText(clientDelayText),
        }).catch((err) => console.error('Notify client delay error:', err))
      }
      if ((maxUserId || maxConversationId) && maxApiBaseUrl && maxApiToken) {
        await sendMaxMessage(maxApiBaseUrl, maxApiToken, {
          userId: maxUserId,
          conversationId: maxConversationId,
          text: enrichedText(clientDelayText),
        }).catch((err) => console.error('Notify MAX client delay error:', err))
      }
    }

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Информация о задержке отправлена клиенту',
      show_alert: false,
    })
    return { ok: true }
  }

  // kind === 'status'
  const fulfillmentType = String((orderDetails as any).fulfillment_type || 'delivery')
  if (unifiedFlowEnabled) {
    const nextStatus: ChatFlowOrderStatus = mapChatCallbackToOrderStatus(status)
    await applyOrderStatusFromChat(event, {
      orderId,
      status: nextStatus,
      source: 'telegram',
      actorUserId: String(query.from?.id || ''),
    })
  }
  const clientText = CLIENT_MESSAGES[status]?.(orderRef)
  if (clientText && !unifiedFlowEnabled) {
    if (customerTelegramId) {
      await telegram(botToken, 'sendMessage', {
        chat_id: customerTelegramId,
        text: enrichedText(clientText),
        reply_markup: status === 'done'
          ? undefined
          : { inline_keyboard: [[{ text: '⏱ Сообщить о задержке', callback_data: `clientDelay_${orderId}` }]] },
      }).catch((err) => console.error('Notify client error:', err))
    }
    if ((maxUserId || maxConversationId) && maxApiBaseUrl && maxApiToken) {
      const maxButtons: Array<Array<Record<string, string>>> = []
      if (status !== 'done' && maxBotUrl) {
        const maxDelayUrl = `${maxBotUrl}${maxBotUrl.includes('?') ? '&' : '?'}startapp=${encodeURIComponent(`orderdelay_${orderId}`)}`
        maxButtons.push([{ type: 'link', text: 'Сообщить о задержке', url: maxDelayUrl }])
      }
      await sendMaxMessage(maxApiBaseUrl, maxApiToken, {
        userId: maxUserId,
        conversationId: maxConversationId,
        text: enrichedText(clientText),
        attachments: maxButtons.length
          ? [{ type: 'inline_keyboard', payload: { buttons: maxButtons } }]
          : undefined,
      }).catch((err) => console.error('Notify MAX client error:', err))
    }
  }

  const appUrlBaseStatus = ((config.appUrl as string) || '').replace(/\/$/, '')
  const dashboardOrderUrlStatus = appUrlBaseStatus
    ? `${appUrlBaseStatus}/dashboard/orders/${encodeURIComponent(orderId)}`
    : ''
  const shopBranchesStatus = await loadActiveShopBranches(event, orderShopId)
  const nextDbStatus = unifiedFlowEnabled ? mapChatCallbackToOrderStatus(status) : String((orderDetails as any).status || 'new')
  const updatedText = withStatusLine(currentText, managerStatusLine(status, fulfillmentType))
  const keyboardBase = {
    orderId,
    fulfillmentType,
    dashboardOrderUrl: dashboardOrderUrlStatus,
    etaButtonsEnabled: flowConfig.etaButtonsEnabled,
    etaPresets: flowConfig.etaPresets,
    branchPickerEnabled: shopBranchesStatus.length > 1,
  }
  const keyboard =
    status === 'done'
      ? buildManagerOrderInlineKeyboard(
          await enrichManagerKeyboardFromOrder(event, {
            ...keyboardBase,
            orderStatus: 'handed_to_customer',
            branchPickerEnabled: false,
          }),
        )
      : buildManagerOrderInlineKeyboard(
          await enrichManagerKeyboardFromOrder(event, {
            ...keyboardBase,
            orderStatus: nextDbStatus,
          }),
        )
  await telegram(botToken, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: updatedText,
    reply_markup: keyboard.inline_keyboard.length ? keyboard : undefined,
  })

  await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
  return { ok: true }
  } catch (error) {
    // Telegram retries updates aggressively on non-2xx.
    // Fail-safe: log internal error and acknowledge update to stop retry storm.
    console.error('webhook telegram handler failed:', error)
    return { ok: true }
  }
})
