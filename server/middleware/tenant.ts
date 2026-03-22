import { createError, defineEventHandler, getHeader } from 'h3'
import {
  extractBotIdFromInitData,
  getShopByBotId,
  getShopByCustomDomain,
  getShopById,
  resolveShopIdFromEvent,
} from '~/server/utils/tenant'

const REQUIRED_PATHS = [
  '/api/order',
  '/api/tenant',
  '/api/products',
  '/api/restaurants',
  '/api/restaurant-zones',
  '/api/cart-bridge',
]

const CUSTOM_DOMAIN_REWRITE_PATHS = new Set(['/', '/cart', '/checkout'])

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null
  return host.trim().toLowerCase().replace(/:\d+$/, '') || null
}

function getPlatformBaseHost(): string | null {
  const config = useRuntimeConfig()
  const explicit = typeof config.public?.platformBaseDomain === 'string' ? config.public.platformBaseDomain : ''
  if (explicit.trim()) return normalizeHost(explicit)

  const appUrl = typeof config.appUrl === 'string' ? config.appUrl : ''
  if (!appUrl) return null
  try {
    return normalizeHost(new URL(appUrl).host)
  } catch {
    return null
  }
}

function isPlatformHost(host: string | null, baseHost: string | null): boolean {
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (!baseHost) return false
  return host === baseHost || host.endsWith(`.${baseHost}`)
}

function extractTenantSlugFromPath(path: string): string | null {
  const [firstSegment] = path.split('?')[0].split('/').filter(Boolean)
  if (!firstSegment) return null
  if (['api', '_nuxt', '__nuxt_error', 'profile', 'link-telegram'].includes(firstSegment)) return null
  if (/\.[a-z0-9]+$/i.test(firstSegment)) return null
  return firstSegment
}

function shouldRewriteCustomDomainPath(path: string): boolean {
  const normalizedPath = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  return CUSTOM_DOMAIN_REWRITE_PATHS.has(normalizedPath)
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  const isCartBridgeGet = path.startsWith('/api/cart-bridge') && event.method === 'GET'
  const requestHost = normalizeHost(getHeader(event, 'x-forwarded-host') || getHeader(event, 'host'))
  const platformBaseHost = getPlatformBaseHost()
  const isCustomDomain = !!requestHost && !isPlatformHost(requestHost, platformBaseHost)

  let shop = isCustomDomain && requestHost
    ? await getShopByCustomDomain(event, requestHost)
    : null

  const shopId = await resolveShopIdFromEvent(event)
  const isRequired = REQUIRED_PATHS.some((prefix) => path.startsWith(prefix))

  if (!shop && shopId) {
    shop = await getShopById(event, shopId)
  }

  if (!shop && !path.startsWith('/api/')) {
    const slugFromPath = extractTenantSlugFromPath(path)
    if (slugFromPath) {
      shop = await getShopById(event, slugFromPath)
    }
  }

  if (!shop) {
    const initData = getHeader(event, 'x-telegram-init-data')
    const botId = initData ? extractBotIdFromInitData(initData) : null
    if (botId) {
      shop = await getShopByBotId(event, botId)
    }
  }

  if (!shop) {
    if (!path.startsWith('/api/')) {
      return
    }
    if (isCartBridgeGet) {
      return
    }
    if (isRequired) {
      throw createError({ statusCode: 404, message: 'Shop not found' })
    }
    return
  }
  if (!shop.is_active) {
    throw createError({ statusCode: 403, message: 'Shop is inactive' })
  }

  event.context.tenant = {
    shopId: shop.id,
    tenantSlug: shop.slug,
    shop,
    telegramBotToken: shop.telegram_bot_token,
    integrationKeys: shop.integration_keys ?? {},
    uiSettings: shop.ui_settings ?? {},
    host: requestHost,
    isCustomDomain,
  }

  if (!path.startsWith('/api/') && isCustomDomain && shouldRewriteCustomDomainPath(path)) {
    const url = new URL(event.node.req.url || path, 'http://internal.local')
    const normalizedPath = (url.pathname.replace(/\/+$/, '') || '/') === '/' ? '' : url.pathname.replace(/\/+$/, '')
    url.pathname = `/${shop.slug}${normalizedPath}`
    event.node.req.url = `${url.pathname}${url.search}`
  }
})
