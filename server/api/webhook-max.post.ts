import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl, parseAuthLinkTokenUuidFromText } from '~/server/utils/authSiteLink'

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
  user?: { user_id?: number | string; is_bot?: boolean; id?: number | string }
  message?: MaxMessage
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

function normalizeAuthTokenUuid(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const plain =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(t)?.[1] ?? null
  return plain ? plain.toLowerCase() : null
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

function normalizeRuPhoneCandidate(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`
  if (digits.length === 10) return `+7${digits}`
  return trimmed.startsWith('+') ? trimmed : `+${digits}`
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
    if (typeof direct === 'string' && direct.trim()) return normalizeRuPhoneCandidate(direct.trim())
    const vcf = p.vcf_info
    if (typeof vcf === 'string' && vcf.trim()) {
      const tel = extractTelFromVcf(vcf.trim())
      if (tel) return normalizeRuPhoneCandidate(tel)
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
  const supportedType = updateType === 'message_created' || updateType === 'bot_started'
  if (!body || !supportedType) {
    return { ok: true }
  }

  const msg = body.message
  if (msg?.sender?.is_bot === true || body.user?.is_bot === true) {
    return { ok: true }
  }

  const actorUserId = extractMaxActorUserId(body)
  const startPayload = extractStartPayload(body)

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

  /** Ответ только контактом (без текста link_) — сохраняем телефон в bridge_payload активного токена. */
  if (updateType === 'message_created' && actorUserId != null) {
    const tokenHint = extractTokenUuidFromUpdate(body)
    const sharedPhone = extractPhoneFromMaxMessageBody(msg)
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

  const phoneFromMessage = extractPhoneFromMaxMessageBody(msg)
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
    try {
      await sendMaxDmRequestContactOnly({
        baseUrl: maxBaseUrl,
        token: maxToken,
        userId: senderId,
      })
    } catch (eContact) {
      console.warn('webhook-max: follow-up request_contact message failed:', eContact)
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
