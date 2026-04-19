import { createError, defineEventHandler, readBody } from 'h3'
import { randomBytes } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'

type BridgeSessionBody = {
  shopId?: string
  scopeKey?: string
  redirectPath?: string
  items?: unknown[]
}

function makeBridgeKey(): string {
  return randomBytes(9).toString('base64url')
}

function sanitizeInternalPath(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/')) return '/checkout?step=1'
  // Reject absolute/protocol-relative URLs to avoid open redirects.
  if (path.startsWith('//')) return '/checkout?step=1'
  return path
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BridgeSessionBody>(event)
  const shopId = typeof body?.shopId === 'string' ? body.shopId.trim() : ''
  if (!shopId) {
    throw createError({ statusCode: 400, statusMessage: 'shopId is required' })
  }

  const bridgeKey = makeBridgeKey()
  const redirectPath = sanitizeInternalPath(body?.redirectPath)
  const scopeKey = typeof body?.scopeKey === 'string' && body.scopeKey.trim() ? body.scopeKey.trim() : shopId
  const items = Array.isArray(body?.items) ? body.items : []
  const payload = { scopeKey, items, redirectPath, shopId }
  const serviceClient = await serverSupabaseServiceRole(event)

  const { error } = await serviceClient
    .from('auth_bridge_sessions')
    .insert({
      bridge_key: bridgeKey,
      shop_id: shopId,
      scope_key: scopeKey,
      payload,
    })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create bridge session' })
  }

  return {
    ok: true,
    bridgeKey,
  }
})
