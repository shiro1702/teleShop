import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl, parseAuthLinkTokenUuidFromText } from '~/server/utils/authSiteLink'

type MaxMessage = {
  sender?: { user_id?: number; is_bot?: boolean }
  recipient?: { chat_id?: number; user_id?: number; chat_type?: string }
  body?: { text?: string }
}

type MaxUpdate = {
  update_type?: string
  message?: MaxMessage
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
      Authorization: `Bearer ${options.token}`,
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
      Authorization: `Bearer ${options.token}`,
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
  if (!body || !supportedType || !body.message) {
    return { ok: true }
  }

  const msg = body.message
  if (msg.sender?.is_bot === true) {
    return { ok: true }
  }

  const text = String(msg.body?.text || '').trim()
  if (!text) {
    return { ok: true }
  }

  const tokenUuid = parseAuthLinkTokenUuidFromText(text)
  if (!tokenUuid) {
    return { ok: true }
  }

  const senderId = typeof msg.sender?.user_id === 'number' ? msg.sender.user_id : null
  if (senderId == null) {
    return { ok: true }
  }

  const chatId = msg.recipient?.chat_id
  const recipientUserId = msg.recipient?.user_id
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
