import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getShopById } from '~/server/utils/tenant'
import { buildVkAuthorizeUrl, generateVkPkcePair } from '~/server/utils/vkOAuth'

type Body = {
  shopId?: string
  citySlug?: string
  redirectPath?: string
  bridgeKey?: string
}

function sanitizeInternalPath(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/')) return '/checkout?step=1'
  if (path.startsWith('//')) return '/checkout?step=1'
  return path
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const shopId = typeof body?.shopId === 'string' ? body.shopId.trim() : ''
  let shop: Awaited<ReturnType<typeof getShopById>> | null = null
  if (shopId) {
    shop = await getShopById(event, shopId)
    if (!shop) {
      throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
    }
  }

  const config = useRuntimeConfig()
  const clientId = String(config.public?.vkIdClientId || '').trim()
  const redirectUri = String(config.vkIdRedirectUri || '').trim()
  const vkBaseUrl = String(config.vkIdBaseUrl || '').trim() || 'https://id.vk.com'
  if (!clientId || !redirectUri) {
    throw createError({ statusCode: 500, statusMessage: 'VK ID OAuth is not configured' })
  }

  const defaultCitySlug =
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'
  const citySlug =
    typeof body?.citySlug === 'string' && body.citySlug.trim() ? body.citySlug.trim() : defaultCitySlug

  const redirectPath = sanitizeInternalPath(body?.redirectPath)
  const serviceClient = await serverSupabaseServiceRole(event)
  let bridgePayload: Record<string, unknown> = {}

  const rawBridge = typeof body?.bridgeKey === 'string' ? body.bridgeKey.trim() : ''
  if (rawBridge && shop) {
    const { data: bridgeRow } = await serviceClient
      .from('auth_bridge_sessions')
      .select('payload, shop_id, expires_at')
      .eq('bridge_key', rawBridge)
      .maybeSingle()

    const isExpired = bridgeRow?.expires_at
      ? new Date(String(bridgeRow.expires_at)).getTime() < Date.now()
      : true
    const bridgeShop = bridgeRow?.shop_id != null ? String(bridgeRow.shop_id) : ''
    const matchesShop = bridgeShop === shop.id || bridgeShop === shop.slug
    if (bridgeRow && !isExpired && matchesShop) {
      bridgePayload = { ...(bridgeRow.payload as Record<string, unknown>) }
      await serviceClient.from('auth_bridge_sessions').delete().eq('bridge_key', rawBridge)
    }
  }

  bridgePayload.link_context = {
    shop_slug: shop?.slug || undefined,
    city_slug: citySlug,
    redirect_path: redirectPath,
    custom_domain_hostname: shop?.custom_domain ? String(shop.custom_domain).trim() : null,
  }

  const token = randomUUID()
  const { state, codeVerifier, codeChallenge } = generateVkPkcePair()
  const authorizeUrl = buildVkAuthorizeUrl({
    baseUrl: vkBaseUrl,
    clientId,
    redirectUri,
    state,
    codeChallenge,
  })

  const { error } = await serviceClient.from('auth_tokens').insert({
    token,
    telegram_id: null,
    channel: 'vk',
    bridge_payload: bridgePayload,
    vk_state: state,
    vk_code_verifier: codeVerifier,
  })
  if (error) {
    console.error('request-vk-link insert failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create VK link token' })
  }

  return {
    ok: true,
    token,
    authorizeUrl,
  }
})
