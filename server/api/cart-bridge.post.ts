import { createError, defineEventHandler, readBody } from 'h3'
import { randomBytes } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'

interface BridgeRequestBody {
  items: unknown[]
  scopeKey?: string
  channel?: 'telegram' | 'max'
}

function makeBridgeKey(): string {
  return randomBytes(9).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const tenant = event.context.tenant
  const botName = (config.public as any).telegramBotName as string | undefined
  const maxBotUrlRaw = ((config.public as any).maxBotUrl as string | undefined) || ''
  const maxBotUrl = maxBotUrlRaw.trim()
  const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')
  const appUrl = tenant?.shop?.custom_domain
    ? `https://${tenant.shop.custom_domain}`
    : tenant?.shop?.slug
      ? `${appUrlBase}/${encodeURIComponent(tenant.shop.slug)}`
      : appUrlBase

  const body = await readBody<BridgeRequestBody | null>(event)
  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected items for bridge token' })
  }

  const channel = body.channel === 'max' ? 'max' : 'telegram'
  if (channel === 'telegram' && !botName) {
    throw createError({ statusCode: 500, message: 'telegramBotName is not configured' })
  }
  if (channel === 'max' && !maxBotUrl) {
    throw createError({ statusCode: 500, message: 'maxBotUrl is not configured' })
  }

  const bridgeKey = makeBridgeKey()
  const scopeKey = typeof body.scopeKey === 'string' && body.scopeKey.trim()
    ? body.scopeKey.trim()
    : (tenant?.shop?.slug || tenant?.shopId || null)

  const payload = {
    scopeKey,
    items: Array.isArray(body.items) ? body.items : [],
  }

  const serviceClient = await serverSupabaseServiceRole(event)
  const { error } = await serviceClient
    .from('auth_bridge_sessions')
    .insert({
      bridge_key: bridgeKey,
      shop_id: tenant?.shopId ?? '',
      scope_key: scopeKey,
      payload,
    })
  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to create cart bridge session' })
  }

  const token = `cart_${bridgeKey}`
  const deepLink = channel === 'telegram'
    ? `https://t.me/${botName}?startapp=${encodeURIComponent(token)}`
    : `${maxBotUrl}${maxBotUrl.includes('?') ? '&' : '?'}start=${encodeURIComponent(token)}`

  // дополнительный URL на саму web-версию Mini App (на случай, если нужно)
  const webAppUrl = appUrl || ''

  return {
    ok: true,
    token,
    deepLink,
    webAppUrl,
    channel,
  }
})

