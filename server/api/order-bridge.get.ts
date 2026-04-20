import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type BridgeRole = 'customer' | 'manager'

type OrderBridgePayload = {
  type?: string
  orderId?: string
  shopId?: string
  role?: BridgeRole
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token.trim() : ''
  if (!token || !token.startsWith('order_')) {
    throw createError({ statusCode: 400, message: 'Invalid order bridge token' })
  }

  const bridgeKey = token.slice('order_'.length).trim()
  if (!bridgeKey) {
    throw createError({ statusCode: 400, message: 'Invalid order bridge token' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: row } = await client
    .from('auth_bridge_sessions')
    .select('payload, scope_key, expires_at')
    .eq('bridge_key', bridgeKey)
    .maybeSingle()

  const isExpired = row?.expires_at
    ? new Date(String(row.expires_at)).getTime() < Date.now()
    : true
  if (!row || isExpired) {
    throw createError({ statusCode: 400, message: 'Order bridge token expired' })
  }

  await client.from('auth_bridge_sessions').delete().eq('bridge_key', bridgeKey)

  const payload = ((row.payload ?? {}) as OrderBridgePayload)
  if (payload.type !== 'order') {
    throw createError({ statusCode: 400, message: 'Invalid order bridge payload' })
  }

  const orderId = typeof payload.orderId === 'string' ? payload.orderId.trim() : ''
  const shopId = typeof payload.shopId === 'string' && payload.shopId.trim()
    ? payload.shopId.trim()
    : typeof row.scope_key === 'string' && row.scope_key.trim()
      ? row.scope_key.trim()
      : ''
  const role: BridgeRole = payload.role === 'manager' ? 'manager' : 'customer'
  if (!orderId || !shopId) {
    throw createError({ statusCode: 400, message: 'Invalid order bridge payload' })
  }

  return {
    ok: true,
    orderId,
    shopId,
    role,
  }
})
