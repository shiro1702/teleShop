import { createError, defineEventHandler, readBody } from 'h3'
import { randomBytes } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'

type BridgeRole = 'customer' | 'manager'
type BridgeChannel = 'telegram' | 'max'

interface OrderBridgeBody {
  orderId?: string
  shopId?: string
  role?: BridgeRole
  channel?: BridgeChannel
}

function makeBridgeKey(): string {
  return randomBytes(9).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<OrderBridgeBody | null>(event)
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
  if (!orderId) {
    throw createError({ statusCode: 400, message: 'orderId is required' })
  }

  const role: BridgeRole = body?.role === 'manager' ? 'manager' : 'customer'
  const channel: BridgeChannel = body?.channel === 'max' ? 'max' : 'telegram'
  const tenant = event.context.tenant
  const shopId = typeof body?.shopId === 'string' && body.shopId.trim()
    ? body.shopId.trim()
    : typeof tenant?.shopId === 'string' && tenant.shopId.trim()
      ? tenant.shopId.trim()
      : ''

  if (!shopId) {
    throw createError({ statusCode: 400, message: 'shopId is required' })
  }

  const bridgeKey = makeBridgeKey()
  const payload = {
    type: 'order',
    orderId,
    shopId,
    role,
  }

  const client = await serverSupabaseServiceRole(event)
  const { error } = await client
    .from('auth_bridge_sessions')
    .insert({
      bridge_key: bridgeKey,
      shop_id: shopId,
      scope_key: shopId,
      payload,
    })
  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to create order bridge session' })
  }

  const token = `order_${bridgeKey}`
  const botName = String((config.public as any).telegramBotName || '').trim()
  const maxBotUrl = String((config.public as any).maxBotUrl || '').trim()
  const deepLink = channel === 'max'
    ? (maxBotUrl ? `${maxBotUrl}${maxBotUrl.includes('?') ? '&' : '?'}startapp=${encodeURIComponent(token)}` : '')
    : (botName ? `https://t.me/${botName}?startapp=${encodeURIComponent(token)}` : '')

  return {
    ok: true,
    token,
    deepLink,
    channel,
  }
})
