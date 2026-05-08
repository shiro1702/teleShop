import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl, parseAuthLinkTokenUuidFromText } from '~/server/utils/authSiteLink'
import { applyFestivalModerationAction } from '~/server/utils/festivalUgcModeration'
import { createServiceCallEvent, getStaffResponseText, mapActionToStatus, sendMax } from '~/server/utils/serviceCalls'
import { appendOrderTimelineEntry, getUnifiedFlowConfig } from '~/server/utils/orderFlowActions'
import { getProfilePhone, normalizePhone, setProfilePhone } from '~/server/utils/accountPhoneLink'

type MaxMessage = {
  sender?: { user_id?: number | string; is_bot?: boolean }
  recipient?: { chat_id?: number | string; user_id?: number | string; chat_type?: string }
  body?: {
    text?: string | null
    caption?: string
    attachments?: Array<{
      type?: string
      payload?: { vcf_info?: string | null; vcf_phone?: string | null; [key: string]: unknown } | null
    }> | null
  }
  text?: string
}

type MaxUpdate = {
  update_type?: string
  payload?: string | null
  /** Альтернативное имя стартового параметра в части апдейтов MAX */
  start_payload?: string | null
  chat_id?: number | string
  conversation_id?: number | string
  recipient?: { chat_id?: number | string; user_id?: number | string; chat_type?: string }
  chat?: { id?: number | string; chat_id?: number | string; type?: string }
  dialog?: { id?: number | string; chat_id?: number | string }
  user?: { user_id?: number | string; is_bot?: boolean; id?: number | string }
  message?: MaxMessage
}

type ChatLinkTokenRow = {
  token: string
  shop_id: string
  restaurant_id: string
  expires_at: string
  used_at: string | null
}

function formatOrderRef(orderNumber: unknown, fallbackOrderId: string): string {
  const raw = typeof orderNumber === 'string' && orderNumber.trim() ? orderNumber.trim() : fallbackOrderId.trim()
  const normalized = raw.replace(/\s+/g, '')
  const short = normalized.length > 8 ? normalized.slice(0, 8) : normalized
  return `#${short || '—'}`
}

function extractStartPayload(update: MaxUpdate): string {
  const direct = typeof update.payload === 'string' && update.payload.trim()
    ? update.payload.trim()
    : typeof update.start_payload === 'string' && update.start_payload.trim()
      ? update.start_payload.trim()
      : ''
  if (direct) return direct

  const text = typeof update.message?.body?.text === 'string' ? update.message.body.text.trim() : ''
  if (!text) return ''
  const match = /^\/start(?:@\S+)?\s+(.+)$/i.exec(text)
  return match?.[1]?.trim() || ''
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeNonEmptyId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function normalizeAuthTokenUuid(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const plain =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(t)?.[1] ?? null
  return plain ? plain.toLowerCase() : null
}

function parseMaxBindToken(text: string): string | null {
  const trimmed = text.trim()
  const [first = '', second = ''] = trimmed.split(/\s+/, 2)
  const command = first.toLowerCase()
  if (command === 'bindmax' || command === '/bindmax' || command.startsWith('/bindmax@')) {
    return second ? second.trim() : null
  }
  if (command.startsWith('bindmax_')) {
    const token = first.slice('bindmax_'.length)
    return token ? token.trim() : null
  }
  if (command.startsWith('/bindmax_')) {
    const token = first.slice('/bindmax_'.length)
    return token ? token.trim() : null
  }
  return null
}

function extractMaxBindTokenFromUpdate(update: MaxUpdate, messageText: string): string | null {
  const direct = parseMaxBindToken(messageText)
  if (direct) return direct

  const dump = JSON.stringify(update)
  const match = /(?:^|["\s:/])\/?bindmax(?:@[\w.-]+)?[\s_]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(dump)
  return match?.[1]?.trim() || null
}

function parseMaxServiceCommand(text: string): { serviceCallId: string; action: 'soon' | 'on_my_way' | 'done' } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 3) return null
  const cmd = parts[0].toLowerCase()
  if (cmd !== '/sc' && cmd !== 'sc') return null
  const serviceCallId = parts[1]?.trim()
  const actionRaw = parts[2]?.trim().toLowerCase()
  if (!serviceCallId) return null
  if (actionRaw !== 'soon' && actionRaw !== 'on_my_way' && actionRaw !== 'done') return null
  return { serviceCallId, action: actionRaw }
}

function parseMaxContactCommand(text: string): { serviceCallId: string } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return null
  const cmd = parts[0].toLowerCase()
  if (cmd !== '/contact' && cmd !== 'contact') return null
  const serviceCallId = parts[1]?.trim()
  if (!serviceCallId) return null
  return { serviceCallId }
}

function extractMaxConversationId(update: MaxUpdate): string | null {
  const raw = update as Record<string, unknown>
  const msg = update.message
  const candidates: unknown[] = [
    msg?.recipient?.chat_id,
    update.recipient?.chat_id,
    update.chat_id,
    update.conversation_id,
    update.chat?.chat_id,
    update.chat?.id,
    update.dialog?.chat_id,
    update.dialog?.id,
    raw.conversationId,
    raw.conversation_id,
    raw.chatId,
    raw.chat_id,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeNonEmptyId(candidate)
    if (normalized) return normalized
  }

  const dump = JSON.stringify(update)
  const match = /"(?:conversationId|conversation_id|chatId|chat_id|dialog_id|dialogId)"\s*:\s*"?([^",}\s]+)"?/i.exec(dump)
  return match?.[1]?.trim() || null
}

/** user_id отправителя: сообщение / bot_started (`user`) / альтернативные поля из API MAX. */
function extractMaxActorUserId(body: MaxUpdate): number | null {
  const msg = body.message
  const fromMsg = parseNumericId(msg?.sender?.user_id)
  if (fromMsg != null) return fromMsg
  const fromUser = parseNumericId(body.user?.user_id ?? body.user?.id)
  if (fromUser != null) return fromUser
  const raw = body as Record<string, unknown>
  const usr = raw.user
  if (usr && typeof usr === 'object') {
    const u = usr as Record<string, unknown>
    const id = parseNumericId(u.user_id ?? u.id)
    if (id != null) return id
  }
  return parseNumericId(raw.user_id)
}

function extractTokenUuidFromUpdate(update: MaxUpdate): string | null {
  const payloadSources = [
    String(update.payload || ''),
    String(update.start_payload || ''),
  ]
  for (const s of payloadSources) {
    const payloadToken = parseAuthLinkTokenUuidFromText(s)
    if (payloadToken) return normalizeAuthTokenUuid(payloadToken)
    const plainUuid = normalizeAuthTokenUuid(s)
    if (plainUuid) return plainUuid
  }

  const msg = update.message
  const candidates = [
    typeof msg?.body?.text === 'string' ? msg.body.text : '',
    typeof msg?.body?.caption === 'string' ? msg.body.caption : '',
    typeof msg?.text === 'string' ? msg.text : '',
  ]

  for (const raw of candidates) {
    const token = parseAuthLinkTokenUuidFromText(raw)
    if (token) return normalizeAuthTokenUuid(token)
    const plain = normalizeAuthTokenUuid(raw)
    if (plain) return plain
  }

  // Fallback: MAX может присылать start-параметр в неожиданных полях.
  const dump = JSON.stringify(update)
  const hit = /link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(dump)
  return hit?.[1] ? normalizeAuthTokenUuid(hit[1]) : null
}

function extractTelFromVcf(vcf: string): string | null {
  const compact = vcf.replace(/\r?\n/g, '\n')
  const telLine = compact.split('\n').find((line) => /^([^:]*:)?TEL/i.test(line.trim()))
  if (telLine) {
    const raw = telLine.replace(/^[^:]+:\s*/i, '').trim()
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 10) return raw
  }
  const loose = compact.match(/\+?\d[\d\s().-]{8,}\d/)
  return loose ? loose[0].replace(/\s/g, '') : null
}

/** Телефон из вложения contact (ответ на кнопку request_contact). */
function extractPhoneFromMaxMessageBody(msg: MaxMessage | undefined): string | null {
  const atts = msg?.body?.attachments
  if (!Array.isArray(atts)) return null
  for (const a of atts) {
    if (!a || typeof a !== 'object') continue
    if (String(a.type || '') !== 'contact') continue
    const p = a.payload
    if (!p || typeof p !== 'object') continue
    const direct = p.vcf_phone
    if (typeof direct === 'string' && direct.trim()) return normalizePhone(direct.trim())
    const vcf = p.vcf_info
    if (typeof vcf === 'string' && vcf.trim()) {
      const tel = extractTelFromVcf(vcf.trim())
      if (tel) return normalizePhone(tel)
    }
  }
  return null
}

/** Ссылка + буфер — без request_contact (часть клиентов MAX отклоняет «толстую» клавиатуру целиком). */
async function sendMaxDmWithLinkAndClipboard(options: {
  baseUrl: string
  token: string
  userId: number
  text: string
  linkUrl: string
}): Promise<void> {
  const base = options.baseUrl.replace(/\/$/, '')
  const url = `${base}/messages?user_id=${encodeURIComponent(String(options.userId))}`
  const attachments = [
    {
      type: 'inline_keyboard',
      payload: {
        buttons: [
          [
            {
              type: 'link',
              text: 'Открыть сайт для входа',
              url: options.linkUrl,
            },
          ],
          [
            {
              type: 'clipboard',
              text: 'Скопировать ссылку',
              payload: options.linkUrl,
            },
          ],
        ],
      },
    },
  ]

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: options.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
      attachments,
    }),
  })

  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`max_send_failed:${res.status}:${bodyText}`)
  }
}

/** Отдельное сообщение только с кнопкой контакта (совместимость API). */
async function sendMaxDmRequestContactOnly(options: {
  baseUrl: string
  token: string
  userId: number
}): Promise<void> {
  const base = options.baseUrl.replace(/\/$/, '')
  const url = `${base}/messages?user_id=${encodeURIComponent(String(options.userId))}`
  const attachments = [
    {
      type: 'inline_keyboard',
      payload: {
        buttons: [[{ type: 'request_contact', text: 'Поделиться номером' }]],
      },
    },
  ]
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: options.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'По желанию нажмите кнопку ниже, чтобы мы сохранили номер для заказов.',
      attachments,
    }),
  })
  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`max_send_contact_row_failed:${res.status}:${bodyText}`)
  }
}

async function sendMaxDmPlain(options: {
  baseUrl: string
  token: string
  userId: number
  text: string
}): Promise<void> {
  const base = options.baseUrl.replace(/\/$/, '')
  const url = `${base}/messages?user_id=${encodeURIComponent(String(options.userId))}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: options.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: options.text }),
  })
  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`max_send_failed:${res.status}:${bodyText}`)
  }
}

async function sendMaxToConversation(options: {
  baseUrl: string
  token: string
  conversationId: string
  text: string
}): Promise<void> {
  const base = options.baseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      Authorization: options.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: options.conversationId,
      text: options.text,
    }),
  })
  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`max_send_conversation_failed:${res.status}:${bodyText}`)
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = typeof config.maxWebhookSecret === 'string' ? config.maxWebhookSecret.trim() : ''
  if (secret) {
    const header = getHeader(event, 'x-max-bot-api-secret') || ''
    if (header !== secret) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const maxBaseUrl = String(config.maxApiBaseUrl || '').trim()
  const maxToken = String(config.maxApiToken || '').trim()
  if (!maxBaseUrl || !maxToken) {
    console.error('webhook-max: NUXT_MAX_API_BASE_URL or NUXT_MAX_API_TOKEN missing')
    throw createError({ statusCode: 500, statusMessage: 'MAX API not configured' })
  }

  const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')
  const defaultCitySlug =
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'

  const body = await readBody<MaxUpdate>(event)
  const updateType = String(body?.update_type || '').trim()
  if (!body) {
    return { ok: true }
  }
  const incomingText = typeof body.message?.body?.text === 'string'
    ? body.message.body.text.trim()
    : typeof body.message?.text === 'string'
      ? body.message.text.trim()
      : ''
  const hasBindCommand = Boolean(extractMaxBindTokenFromUpdate(body, incomingText))
  const supportedType = updateType === 'message_created' || updateType === 'bot_started'
  if (!supportedType && !hasBindCommand) {
    return { ok: true }
  }

  const msg = body.message
  if (msg?.sender?.is_bot === true || body.user?.is_bot === true) {
    return { ok: true }
  }

  const actorUserId = extractMaxActorUserId(body)
  const startPayload = extractStartPayload(body)
  const messageTextRaw = typeof msg?.body?.text === 'string'
    ? msg.body.text.trim()
    : typeof msg?.text === 'string'
      ? msg.text.trim()
      : ''

  if (actorUserId != null && startPayload.startsWith('linkmaxchat_')) {
    const token = startPayload.slice('linkmaxchat_'.length).trim()
    if (!token) {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: 'Не удалось прочитать токен привязки. Сгенерируйте ссылку заново в кабинете.',
      }).catch((e) => console.error('webhook-max: linkmaxchat invalid token ack failed:', e))
      return { ok: true }
    }
    await sendMaxDmPlain({
      baseUrl: maxBaseUrl,
      token: maxToken,
      userId: actorUserId,
      text: [
        'Токен привязки MAX получен.',
        'Теперь добавьте MAX-бота в нужную группу менеджеров и отправьте там команду:',
        `/bindmax ${token}`,
        '',
        'После команды этот MAX-чат будет привязан к филиалу.',
      ].join('\n'),
    }).catch((e) => console.error('webhook-max: linkmaxchat instructions failed:', e))
    return { ok: true }
  }

  if (actorUserId != null && startPayload.startsWith('orderdelay_')) {
    const orderId = startPayload.slice('orderdelay_'.length).trim()
    if (!orderId) return { ok: true }

    const supabaseDelay = await serverSupabaseServiceRole(event)
    const signalKey = `max_client_delay_signal:${orderId}:${actorUserId}`
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingSignal } = await supabaseDelay
      .from('notification_events')
      .select('id,updated_at')
      .eq('notification_key', signalKey)
      .gte('updated_at', fiveMinutesAgo)
      .maybeSingle()

    if (existingSignal?.id) {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: 'Сигнал уже отправлен недавно. Повторите чуть позже.',
      }).catch((e) => console.error('webhook-max: delay duplicate ack failed:', e))
      return { ok: true }
    }

    const { data: order } = await supabaseDelay
      .from('orders')
      .select('id,order_number,shop_id,restaurant_id')
      .eq('id', orderId)
      .maybeSingle()
    await getUnifiedFlowConfig(event, String((order as any).restaurant_id || ''))
    await appendOrderTimelineEntry(event, {
      orderId,
      shopId: String((order as any).shop_id),
      label: 'Клиент отправил сигнал о задержке из MAX',
      source: 'max',
      userId: String(actorUserId),
      comment: null,
    })

    if (!order) {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: 'Заказ не найден.',
      }).catch((e) => console.error('webhook-max: delay order not found ack failed:', e))
      return { ok: true }
    }

    const { data: branch } = await supabaseDelay
      .from('restaurants')
      .select('name,manager_group_chat_id,manager_max_chat_id')
      .eq('id', (order as any).restaurant_id)
      .maybeSingle()
    const { data: shop } = await supabaseDelay
      .from('shops')
      .select('telegram_bot_token')
      .eq('id', (order as any).shop_id)
      .maybeSingle()

    const managerTgChatId = typeof (branch as any)?.manager_group_chat_id === 'string'
      ? String((branch as any).manager_group_chat_id).trim()
      : ''
    const managerMaxChatId = typeof (branch as any)?.manager_max_chat_id === 'string'
      ? String((branch as any).manager_max_chat_id).trim()
      : ''
    const telegramBotToken = typeof (shop as any)?.telegram_bot_token === 'string'
      ? String((shop as any).telegram_bot_token).trim()
      : ''

    const managerText = [
      '⚠️ Клиент сообщил о задержке',
      `📦 Заказ ${formatOrderRef((order as any)?.order_number, orderId)}`,
      `🏪 Филиал: ${String((branch as any)?.name || '—')}`,
      `👤 Клиент MAX: id:${actorUserId}`,
    ].join('\n')

    if (managerTgChatId && telegramBotToken) {
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: managerTgChatId,
          text: managerText,
        }),
      }).catch((e) => console.error('webhook-max: delay notify manager telegram failed:', e))
    }
    if (managerMaxChatId) {
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: managerMaxChatId,
        text: managerText,
      }).catch((e) => console.error('webhook-max: delay notify manager max failed:', e))
    }

    await supabaseDelay.from('notification_events').upsert({
      notification_key: signalKey,
      event_type: 'ORDER_STATUS_CHANGED',
      channel: 'max',
      shop_id: (order as any).shop_id,
      restaurant_id: (order as any).restaurant_id,
      conversation_id: managerMaxChatId || managerTgChatId || null,
      delivery_status: 'sent',
      attempt_count: 1,
      payload: { orderId, fromMaxUserId: actorUserId, source: 'client_delay_signal_max' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'notification_key' })

    await sendMaxDmPlain({
      baseUrl: maxBaseUrl,
      token: maxToken,
      userId: actorUserId,
      text: 'Сигнал отправлен менеджеру ресторана.',
    }).catch((e) => console.error('webhook-max: delay ack failed:', e))

    return { ok: true }
  }

  const bindToken = extractMaxBindTokenFromUpdate(body, messageTextRaw)
  if (bindToken) {
    const conversationIdValue = extractMaxConversationId(body)
    console.info('webhook-max: bindmax command received', {
      updateType,
      hasConversationId: Boolean(conversationIdValue),
      conversationId: conversationIdValue,
      tokenPrefix: bindToken.slice(0, 8),
      messageText: messageTextRaw,
    })
    if (!conversationIdValue) {
      console.warn('webhook-max: bindmax conversation id not found', {
        updateType,
        payload: body.payload ?? null,
        start_payload: body.start_payload ?? null,
        messageRecipient: msg?.recipient ?? null,
        chat_id: body.chat_id ?? null,
      })
      if (actorUserId != null) {
        await sendMaxDmPlain({
          baseUrl: maxBaseUrl,
          token: maxToken,
          userId: actorUserId,
          text: 'Команда bindmax работает только в группе менеджеров. Отправьте её в нужном MAX-чате.',
        }).catch(() => {})
      }
      return { ok: true }
    }

    const supabase = await serverSupabaseServiceRole(event)
    const { data: tokenRow } = await supabase
      .from('telegram_chat_link_tokens')
      .select('token,shop_id,restaurant_id,expires_at,used_at')
      .eq('token', bindToken)
      .maybeSingle<ChatLinkTokenRow>()

    if (!tokenRow) {
      console.warn('webhook-max: bindmax token not found', { tokenPrefix: bindToken.slice(0, 8) })
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: conversationIdValue,
        text: 'Токен привязки не найден. Сгенерируйте новую ссылку в кабинете.',
      }).catch(() => {})
      return { ok: true }
    }
    if (tokenRow.used_at) {
      console.warn('webhook-max: bindmax token already used', { tokenPrefix: bindToken.slice(0, 8) })
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: conversationIdValue,
        text: 'Этот токен уже использован. Сгенерируйте новый в кабинете.',
      }).catch(() => {})
      return { ok: true }
    }
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      console.warn('webhook-max: bindmax token expired', { tokenPrefix: bindToken.slice(0, 8), expiresAt: tokenRow.expires_at })
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: conversationIdValue,
        text: 'Токен истек. Сгенерируйте новый в кабинете.',
      }).catch(() => {})
      return { ok: true }
    }

    const { data: existingRestaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('manager_max_chat_id', conversationIdValue)
      .neq('id', tokenRow.restaurant_id)
      .maybeSingle<{ id: string }>()
    if (existingRestaurant?.id) {
      console.warn('webhook-max: bindmax chat already linked', {
        conversationId: conversationIdValue,
        existingRestaurantId: existingRestaurant.id,
      })
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: conversationIdValue,
        text: 'Этот MAX-чат уже привязан к другому ресторану.',
      }).catch(() => {})
      return { ok: true }
    }

    const { data: updatedRestaurant, error: updateError } = await supabase
      .from('restaurants')
      .update({ manager_max_chat_id: conversationIdValue })
      .eq('id', tokenRow.restaurant_id)
      .eq('shop_id', tokenRow.shop_id)
      .select('name')
      .maybeSingle<{ name: string }>()

    if (updateError || !updatedRestaurant) {
      console.error('Bind MAX chat update restaurant failed:', updateError)
      await sendMaxToConversation({
        baseUrl: maxBaseUrl,
        token: maxToken,
        conversationId: conversationIdValue,
        text: 'Не удалось сохранить привязку MAX-чата. Попробуйте еще раз.',
      }).catch(() => {})
      return { ok: true }
    }

    await supabase
      .from('telegram_chat_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', bindToken)
      .is('used_at', null)

    await sendMaxToConversation({
      baseUrl: maxBaseUrl,
      token: maxToken,
      conversationId: conversationIdValue,
      text: `MAX-чат успешно привязан к ресторану "${updatedRestaurant.name}".`,
    }).catch(() => {})
    console.info('webhook-max: bindmax linked restaurant', {
      conversationId: conversationIdValue,
      restaurantId: tokenRow.restaurant_id,
      tokenPrefix: bindToken.slice(0, 8),
    })
    return { ok: true }
  }

  if (actorUserId != null) {
    const contactCommand = parseMaxContactCommand(messageTextRaw)
    if (contactCommand) {
      const supabase = await serverSupabaseServiceRole(event)
      const { data: callRow } = await supabase
        .from('service_calls')
        .select('id,shop_id,restaurant_id,customer_telegram_id,customer_max_user_id,customer_max_conversation_id,customer_profile_id')
        .eq('id', contactCommand.serviceCallId)
        .maybeSingle()
      if (!callRow) {
        await sendMaxDmPlain({
          baseUrl: maxBaseUrl,
          token: maxToken,
          userId: actorUserId,
          text: 'Service call не найден.',
        }).catch(() => {})
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
      const contactRequestText = knownPhone
        ? `Менеджер ресторана "${String((restaurant as any)?.name || 'Ресторан')}" хочет связаться с вами. Ваш номер уже сохранен: ${knownPhone}.`
        : `Менеджер ресторана "${String((restaurant as any)?.name || 'Ресторан')}" хочет связаться с вами. Поделиться контактом?`

      const botToken = String((config.botToken as string) || '').trim()
      const customerTelegramIdRaw = Number((callRow as any).customer_telegram_id)
      const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0 ? customerTelegramIdRaw : null
      if (customerTelegramId && botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: customerTelegramId,
            text: contactRequestText,
            ...(knownPhone ? {} : {
              reply_markup: {
                keyboard: [[{ text: 'Поделиться номером', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }),
          }),
        }).catch(() => {})
      }
      const customerMaxConversationId = typeof (callRow as any).customer_max_conversation_id === 'string'
        ? String((callRow as any).customer_max_conversation_id).trim()
        : ''
      const customerMaxUserId = typeof (callRow as any).customer_max_user_id === 'string'
        ? String((callRow as any).customer_max_user_id).trim()
        : ''
      if (customerMaxConversationId || customerMaxUserId) {
        await sendMax(maxBaseUrl, maxToken, {
          conversationId: customerMaxConversationId || undefined,
          userId: customerMaxConversationId ? undefined : customerMaxUserId || undefined,
          text: contactRequestText,
          attachments: knownPhone
            ? undefined
            : [{
              type: 'inline_keyboard',
              payload: { buttons: [[{ type: 'request_contact', text: 'Поделиться номером' }]] },
            }],
        }).catch(() => {})
      }
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: knownPhone ? `Номер клиента: ${knownPhone}` : 'Запрос контакта отправлен клиенту',
      }).catch(() => {})
      return { ok: true }
    }

    const serviceCommand = parseMaxServiceCommand(messageTextRaw)
    if (serviceCommand) {
      const conversationId = extractMaxConversationId(body)
      if (!conversationId) {
        await sendMaxDmPlain({
          baseUrl: maxBaseUrl,
          token: maxToken,
          userId: actorUserId,
          text: 'Команду /sc нужно отправлять из рабочего MAX-группового чата.',
        }).catch(() => {})
        return { ok: true }
      }
      const supabase = await serverSupabaseServiceRole(event)
      const { data: callRow } = await supabase
        .from('service_calls')
        .select('id,shop_id,restaurant_id,order_id,customer_telegram_id,customer_max_user_id,customer_max_conversation_id')
        .eq('id', serviceCommand.serviceCallId)
        .maybeSingle()
      if (!callRow) {
        await sendMaxDmPlain({
          baseUrl: maxBaseUrl,
          token: maxToken,
          userId: actorUserId,
          text: 'Service call не найден.',
        }).catch(() => {})
        return { ok: true }
      }

      const externalUserId = String(actorUserId)
      const { data: binding } = await supabase
        .from('restaurant_staff_bot_bindings')
        .select('id,display_name')
        .eq('shop_id', (callRow as any).shop_id)
        .eq('restaurant_id', (callRow as any).restaurant_id)
        .eq('channel', 'max')
        .eq('external_user_id', externalUserId)
        .maybeSingle()

      const nowIso = new Date().toISOString()
      const nextStatus = mapActionToStatus(serviceCommand.action)
      const { data: currentCall } = await supabase
        .from('service_calls')
        .select('first_response_at')
        .eq('id', serviceCommand.serviceCallId)
        .maybeSingle()
      const patch: Record<string, unknown> = { status: nextStatus, updated_at: nowIso }
      if (!(currentCall as any)?.first_response_at) patch.first_response_at = nowIso
      if (nextStatus === 'resolved') patch.resolved_at = nowIso
      await supabase.from('service_calls').update(patch).eq('id', serviceCommand.serviceCallId)

      const responseText = getStaffResponseText(serviceCommand.action)
      const actorName = typeof (binding as any).display_name === 'string' && (binding as any).display_name.trim()
        ? String((binding as any).display_name).trim()
        : `Сотрудник ${externalUserId}`

      await createServiceCallEvent(event, {
        serviceCallId: serviceCommand.serviceCallId,
        shopId: String((callRow as any).shop_id),
        restaurantId: String((callRow as any).restaurant_id),
        orderId: (callRow as any).order_id ? String((callRow as any).order_id) : null,
        eventType: 'staff_response',
        eventStatus: nextStatus,
        channel: 'max',
        actorBindingId: (binding as any)?.id ? String((binding as any).id) : null,
        actorExternalUserId: externalUserId,
        actorDisplayName: actorName,
        message: responseText,
        extraPayload: { action: serviceCommand.action, conversationId },
      })

      const customerText = `Ответ персонала: ${responseText}`
      const botToken = String((config.botToken as string) || '').trim()
      const customerTelegramIdRaw = Number((callRow as any).customer_telegram_id)
      const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0 ? customerTelegramIdRaw : null
      if (customerTelegramId && botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: customerTelegramId, text: customerText }),
        }).catch(() => {})
      }
      const customerMaxConversationId = typeof (callRow as any).customer_max_conversation_id === 'string'
        ? String((callRow as any).customer_max_conversation_id).trim()
        : ''
      const customerMaxUserId = typeof (callRow as any).customer_max_user_id === 'string'
        ? String((callRow as any).customer_max_user_id).trim()
        : ''
      if (customerMaxConversationId || customerMaxUserId) {
        await sendMax(maxBaseUrl, maxToken, {
          conversationId: customerMaxConversationId || undefined,
          userId: customerMaxConversationId ? undefined : customerMaxUserId || undefined,
          text: customerText,
        }).catch(() => {})
      }

      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: `Ответ отправлен: ${responseText}`,
      }).catch(() => {})
      return { ok: true }
    }
  }

  if (actorUserId != null && /^ugc\s+/i.test(messageTextRaw)) {
    const [, rawAction = '', rawSubmissionId = ''] = messageTextRaw.split(/\s+/, 3)
    const actionName = rawAction.trim().toLowerCase()
    const submissionId = rawSubmissionId.trim()
    if (!submissionId) {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: 'Формат команды: ugc <action> <submissionId>',
      }).catch(() => {})
      return { ok: true }
    }
    const map = (): {
      action: 'approve_menu' | 'approve_menu_and_feed' | 'tag_category' | 'forward_to_corner' | 'reject' | 'shadow_ban'
      category?: 'food' | 'stage' | 'vibe' | 'quest' | 'live' | null
      label: string
    } => {
      if (actionName === 'approve_menu') return { action: 'approve_menu', label: 'Опубликовано в меню' }
      if (actionName === 'approve_menu_and_feed') return { action: 'approve_menu_and_feed', label: 'Опубликовано в меню и в ленте' }
      if (actionName === 'tag_food') return { action: 'tag_category', category: 'food', label: 'Категория: еда' }
      if (actionName === 'tag_stage') return { action: 'tag_category', category: 'stage', label: 'Категория: сцена' }
      if (actionName === 'tag_vibe') return { action: 'tag_category', category: 'vibe', label: 'Категория: вайб' }
      if (actionName === 'tag_quest') return { action: 'tag_category', category: 'quest', label: 'Категория: квест' }
      if (actionName === 'forward') return { action: 'forward_to_corner', label: 'Переслано менеджеру корнера' }
      if (actionName === 'ban') return { action: 'shadow_ban', label: 'Пользователь отправлен в теневой бан' }
      return { action: 'reject', label: 'Отклонено' }
    }
    const mapped = map()
    try {
      await applyFestivalModerationAction(event, {
        submissionId,
        action: mapped.action,
        category: mapped.category,
        actorChannel: 'max',
        actorUserId: String(actorUserId),
      })
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: `UGC: ${mapped.label}`,
      }).catch(() => {})
    } catch (err) {
      console.error('webhook-max ugc moderation failed:', err)
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: actorUserId,
        text: 'Не удалось применить действие модерации UGC',
      }).catch(() => {})
    }
    return { ok: true }
  }

  /** Ответ только контактом (без текста link_) — сохраняем телефон в bridge_payload активного токена. */
  if (updateType === 'message_created' && actorUserId != null) {
    const tokenHint = extractTokenUuidFromUpdate(body)
    const sharedPhone = normalizePhone(extractPhoneFromMaxMessageBody(msg) || '')
    if (sharedPhone && !tokenHint) {
      const supabaseEarly = await serverSupabaseServiceRole(event)
      const { data: tokenForContact } = await supabaseEarly
        .from('auth_tokens')
        .select('token, bridge_payload')
        .eq('channel', 'max')
        .eq('max_user_id', String(actorUserId))
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tokenForContact?.token) {
        const prev = ((tokenForContact as { bridge_payload?: Record<string, unknown> }).bridge_payload ??
          {}) as Record<string, unknown>
        await supabaseEarly
          .from('auth_tokens')
          .update({
            bridge_payload: { ...prev, max_shared_phone: sharedPhone },
          })
          .eq('token', tokenForContact.token)
        const { data: profile } = await supabaseEarly
          .from('profiles')
          .select('id')
          .eq('max_user_id', String(actorUserId))
          .maybeSingle()
        if (profile?.id) {
          await setProfilePhone(supabaseEarly as any, String(profile.id), sharedPhone)
        }
        try {
          await sendMaxDmPlain({
            baseUrl: maxBaseUrl,
            token: maxToken,
            userId: actorUserId,
            text: 'Номер сохранён. Завершите вход на сайте.',
          })
        } catch (e) {
          console.error('webhook-max contact ack:', e)
        }
        return { ok: true }
      }
    }
  }

  const tokenUuid = extractTokenUuidFromUpdate(body)
  if (!tokenUuid) {
    console.info('webhook-max: token not found in update payload', {
      updateType,
      sender: msg?.sender ?? body.user ?? null,
      recipient: msg?.recipient ?? null,
      chat_id: body.chat_id ?? null,
      payload: body.payload ?? null,
      start_payload: body.start_payload ?? null,
    })
    return { ok: true }
  }

  const tokenKey = tokenUuid.toLowerCase()

  const senderId = actorUserId
  if (senderId == null) {
    console.info('webhook-max: sender_id not found/invalid', {
      updateType,
      sender: msg?.sender ?? body.user ?? null,
      user: body.user ?? null,
      payload: body.payload ?? null,
    })
    return { ok: true }
  }

  const chatId = parseNumericId(msg?.recipient?.chat_id) ?? parseNumericId(body.chat_id)
  const recipientUserId = parseNumericId(msg?.recipient?.user_id)
  const conversationKey =
    typeof chatId === 'number'
      ? String(chatId)
      : typeof recipientUserId === 'number'
        ? String(recipientUserId)
        : null

  const maxUserIdStr = String(senderId)
  const supabase = await serverSupabaseServiceRole(event)
  const tenant = event.context.tenant as { shop?: { slug?: string; custom_domain?: string | null } } | undefined

  const { data: row, error: fetchErr } = await supabase
    .from('auth_tokens')
    .select('token, max_user_id, expires_at, bridge_payload, channel')
    .eq('token', tokenKey)
    .maybeSingle()

  if (fetchErr) {
    console.error('webhook-max fetch token:', fetchErr)
    try {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
        text: 'Не удалось проверить ссылку. Попробуйте позже.',
      })
    } catch (e) {
      console.error('webhook-max notify error:', e)
    }
    return { ok: true }
  }

  if (!row || String((row as { channel?: string }).channel || '') !== 'max') {
    try {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
        text: 'Ссылка недействительна или устарела. Запросите вход на сайте ещё раз.',
      })
    } catch (e) {
      console.error('webhook-max notify error:', e)
    }
    return { ok: true }
  }

  const expiresAt = new Date(String((row as { expires_at?: string }).expires_at)).getTime()
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    await supabase.from('auth_tokens').delete().eq('token', tokenKey)
    try {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
        text: 'Срок ссылки истёк. Вернитесь на сайт и запросите вход снова.',
      })
    } catch (e) {
      console.error('webhook-max notify error:', e)
    }
    return { ok: true }
  }

  const existingMax = (row as { max_user_id?: string | null }).max_user_id
  if (existingMax != null && String(existingMax).trim() !== '' && String(existingMax) !== maxUserIdStr) {
    try {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
        text: 'Эта ссылка уже была использована в другом аккаунте MAX. Запросите новую на сайте.',
      })
    } catch (e) {
      console.error('webhook-max notify error:', e)
    }
    return { ok: true }
  }

  if (existingMax == null || String(existingMax).trim() === '') {
    const { data: updated, error: updErr } = await supabase
      .from('auth_tokens')
      .update({
        max_user_id: maxUserIdStr,
        max_conversation_id: conversationKey,
      })
      .eq('token', tokenKey)
      .is('max_user_id', null)
      .select('token')
      .maybeSingle()

    if (updErr) {
      console.error('webhook-max update token:', updErr)
    }

    if (!updated) {
      const { data: again } = await supabase
        .from('auth_tokens')
        .select('max_user_id')
        .eq('token', tokenKey)
        .maybeSingle()
      const rid = (again as { max_user_id?: string | null } | null)?.max_user_id
      if (rid != null && String(rid) !== maxUserIdStr) {
        try {
          await sendMaxDmPlain({
            baseUrl: maxBaseUrl,
            token: maxToken,
            userId: senderId,
            text: 'Эта ссылка уже была использована в другом аккаунте MAX.',
          })
        } catch (e) {
          console.error('webhook-max notify error:', e)
        }
        return { ok: true }
      }
    }
  }

  const phoneFromMessage = normalizePhone(extractPhoneFromMaxMessageBody(msg) || '')
  const baseBridge = ((row as { bridge_payload?: Record<string, unknown> }).bridge_payload ?? null) as
    | Record<string, unknown>
    | null
  const bridgePayload: Record<string, unknown> | null =
    phoneFromMessage
      ? { ...(baseBridge || {}), max_shared_phone: phoneFromMessage }
      : baseBridge
  if (phoneFromMessage) {
    await supabase.from('auth_tokens').update({ bridge_payload: bridgePayload }).eq('token', tokenKey)
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('max_user_id', maxUserIdStr)
    .maybeSingle()
  const existingPhone = existingProfile?.id ? await getProfilePhone(supabase as any, String(existingProfile.id)) : ''
  const shouldAskForContact = !(phoneFromMessage || existingPhone)

  const tokenForLink = typeof (row as { token?: string }).token === 'string'
    ? (row as { token: string }).token
    : tokenKey

  const link = buildAuthSiteLinkUrl({
    linkPath: 'link-max',
    appUrlBase,
    defaultCitySlug,
    token: tokenForLink,
    bridgePayload: bridgePayload ?? null,
    tenantShop: tenant?.shop,
  })

  const messageText = [
    '✅ MAX подтверждён.',
    '',
    'По желанию нажмите «Поделиться номером», чтобы мы сохранили телефон для заказов.',
    'Вернитесь на сайт — вход завершится автоматически. Если страница не обновилась, откройте ссылку кнопкой ниже или скопируйте её.',
  ].join('\n')

  try {
    await sendMaxDmWithLinkAndClipboard({
      baseUrl: maxBaseUrl,
      token: maxToken,
      userId: senderId,
      text: messageText,
      linkUrl: link,
    })
    if (shouldAskForContact) {
      try {
        await sendMaxDmRequestContactOnly({
          baseUrl: maxBaseUrl,
          token: maxToken,
          userId: senderId,
        })
      } catch (eContact) {
        console.warn('webhook-max: follow-up request_contact message failed:', eContact)
      }
    }
  } catch (e) {
    console.warn('webhook-max: send with link keyboard failed, retrying plain:', e)
    try {
      await sendMaxDmPlain({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
        text: `${messageText}\n\n${link}`,
      })
    } catch (e2) {
      console.error('webhook-max plain send failed:', e2)
    }
  }

  return { ok: true }
})
