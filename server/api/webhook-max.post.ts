import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl, parseAuthLinkTokenUuidFromText } from '~/server/utils/authSiteLink'

type MaxMessage = {
  sender?: { user_id?: number | string; is_bot?: boolean }
  recipient?: { chat_id?: number | string; user_id?: number | string; chat_type?: string }
  body?: { text?: string; caption?: string }
  text?: string
}

type MaxUpdate = {
  update_type?: string
  payload?: string | null
  chat_id?: number | string
  user?: { user_id?: number | string; is_bot?: boolean }
  message?: MaxMessage
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractTokenUuidFromUpdate(update: MaxUpdate): string | null {
  const payloadToken = parseAuthLinkTokenUuidFromText(String(update.payload || ''))
  if (payloadToken) return payloadToken

  const msg = update.message
  const candidates = [
    typeof msg?.body?.text === 'string' ? msg.body.text : '',
    typeof msg?.body?.caption === 'string' ? msg.body.caption : '',
    typeof msg?.text === 'string' ? msg.text : '',
  ]

  for (const raw of candidates) {
    const token = parseAuthLinkTokenUuidFromText(raw)
    if (token) return token
  }

  // Fallback: MAX может присылать start-параметр в неожиданных полях.
  const dump = JSON.stringify(update)
  const hit = /link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(dump)
  return hit?.[1] ?? null
}

async function sendMaxDm(options: {
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

  const tokenUuid = extractTokenUuidFromUpdate(body)
  if (!tokenUuid) {
    console.info('webhook-max: token not found in update payload', {
      updateType,
      sender: msg?.sender ?? body.user ?? null,
      recipient: msg?.recipient ?? null,
      chat_id: body.chat_id ?? null,
      payload: body.payload ?? null,
    })
    return { ok: true }
  }

  const senderId = parseNumericId(msg?.sender?.user_id) ?? parseNumericId(body.user?.user_id)
  if (senderId == null) {
    console.info('webhook-max: sender_id not found/invalid', {
      updateType,
      sender: msg?.sender ?? body.user ?? null,
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
    .eq('token', tokenUuid)
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
    await supabase.from('auth_tokens').delete().eq('token', tokenUuid)
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
      .eq('token', tokenUuid)
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
        .eq('token', tokenUuid)
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

  const bridgePayload = (row as { bridge_payload?: Record<string, unknown> }).bridge_payload
  const link = buildAuthSiteLinkUrl({
    linkPath: 'link-max',
    appUrlBase,
    defaultCitySlug,
    token: tokenUuid,
    bridgePayload: bridgePayload ?? null,
    tenantShop: tenant?.shop,
  })

  const messageText = [
    '✅ MAX подтверждён.',
    '',
    'Вернитесь на сайт — вход завершится автоматически. Если страница не обновилась, откройте ссылку кнопкой ниже или скопируйте её.',
  ].join('\n')

  try {
    await sendMaxDm({
      baseUrl: maxBaseUrl,
      token: maxToken,
      userId: senderId,
      text: messageText,
      linkUrl: link,
    })
  } catch (e) {
    console.warn('webhook-max: send with keyboard failed, retrying plain:', e)
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
