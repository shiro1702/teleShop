import { createError, defineEventHandler, getHeader, sendRedirect } from 'h3'
import {
  extractBotIdFromInitData,
  getShopByBotId,
  getShopByCustomDomain,
  getShopById,
  resolveCanonicalTenantCartPath,
  resolveShopIdFromEvent,
} from '~/server/utils/tenant'
import { getStyleRecord } from '~/server/utils/organizationStyle'

const REQUIRED_PATHS = [
  '/api/order',
  '/api/checkout/create',
  '/api/client-order-status',
  '/api/tenant',
  '/api/products',
  '/api/restaurants',
  '/api/restaurant-zones',
  '/api/cart-bridge',
  '/api/stories',
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

function extractTenantSlugFromPath(path: string, defaultCitySlug: string | null): string | null {
  const segments = path.split('?')[0].split('/').filter(Boolean)
  const [firstSegment, secondSegment] = segments

  if (!firstSegment) return null
  if (['api', '_nuxt', '__nuxt_error', 'profile', 'link-telegram'].includes(firstSegment)) return null
  if (/\.[a-z0-9]+$/i.test(firstSegment)) return null

  // Поддержка URL-схемы агрегатора: /{city_slug}/{tenant_slug}/...
  // Для restaurant-страниц tenant_slug должен браться из второго сегмента.
  if (defaultCitySlug && firstSegment === defaultCitySlug) {
    return secondSegment ?? null
  }

  return firstSegment
}

function shouldRewriteCustomDomainPath(path: string): boolean {
  const normalizedPath = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  return CUSTOM_DOMAIN_REWRITE_PATHS.has(normalizedPath)
}

function extractCityAndTenantFromPath(path: string): { citySlug: string; tenantSlug: string } | null {
  const segments = path.split('?')[0].split('/').filter(Boolean)
  if (segments.length < 2) return null
  const [citySlug, tenantSlug] = segments
  if (!citySlug || !tenantSlug) return null
  if (['api', '_nuxt', '__nuxt_error', 'profile', 'link-telegram'].includes(citySlug)) return null
  if (/\.[a-z0-9]+$/i.test(citySlug) || /\.[a-z0-9]+$/i.test(tenantSlug)) return null
  return { citySlug, tenantSlug }
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  const normalizedPath = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  const isLegacyFlatCheckout = normalizedPath === '/checkout'
  const isCartBridgeGet = path.startsWith('/api/cart-bridge') && event.method === 'GET'
  const config = useRuntimeConfig()
  const defaultCitySlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug : null
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
    const slugFromPath = extractTenantSlugFromPath(path, defaultCitySlug)
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
      const cityAndTenant = extractCityAndTenantFromPath(path)
      if (cityAndTenant) {
        return sendRedirect(event, `/${cityAndTenant.citySlug}/`, 302)
      }
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

  if (!path.startsWith('/api/') && isLegacyFlatCheckout) {
    const canonical = await resolveCanonicalTenantCartPath(event, shop)
    return sendRedirect(event, canonical.cartPath, 302)
  }

  let uiSettings = shop.ui_settings ?? {}
  let shopName = shop.name

  // MVP: подмешиваем organization_style_settings в context для SSR-рендера витрины.
  // Это гарантирует, что цвета/логотип/описание применятся даже когда frontend не успел
  // сделать запрос на `/api/tenant`.
  if (!path.startsWith('/api/')) {
    try {
      const record = await getStyleRecord(event, shop.id)
      const cfg = record.config
      const nextSmallLogo = typeof cfg.identity.logoSmallUrl === 'string' ? cfg.identity.logoSmallUrl.trim() : ''
      const nextLargeLogo = typeof cfg.identity.logoLargeUrl === 'string' ? cfg.identity.logoLargeUrl.trim() : ''
      const nextLogo = nextSmallLogo || (typeof cfg.identity.logoUrl === 'string' ? cfg.identity.logoUrl.trim() : '')
      const nextDesc = typeof cfg.identity.shortDescription === 'string' ? cfg.identity.shortDescription.trim() : ''
      const fallbackLogo = typeof uiSettings?.logo_url === 'string' ? (uiSettings as any).logo_url : ''
      const fallbackDesc = typeof uiSettings?.description === 'string' ? (uiSettings as any).description : ''

      uiSettings = {
        ...uiSettings,
        logo_url: nextLogo || fallbackLogo,
        logo_large_url: nextLargeLogo || nextLogo || fallbackLogo,
        description: nextDesc || fallbackDesc,
        ...deriveTenantThemeFromStyle(cfg),
        radius_button: `${cfg.radii.button}px`,
        radius_modal: `${cfg.radii.modal}px`,
        radius_input: `${cfg.radii.input}px`,
        radius_card: `${cfg.radii.card}px`,
      }
      shopName = cfg.identity.name || shopName
      ;(shop as any).name = shopName
    } catch {
      // best-effort: витрина не должна ломаться из-за проблем со схемой/таблицей
    }
  }

  event.context.tenant = {
    shopId: shop.id,
    shop,
    telegramBotToken: shop.telegram_bot_token,
    integrationKeys: shop.integration_keys ?? {},
    uiSettings,
    isCustomDomain,
  } as any

  if (!path.startsWith('/api/') && isCustomDomain && shouldRewriteCustomDomainPath(path)) {
    const url = new URL(event.node.req.url || path, 'http://internal.local')
    const normalizedPath = (url.pathname.replace(/\/+$/, '') || '/') === '/' ? '' : url.pathname.replace(/\/+$/, '')
    url.pathname = `/${shop.slug}${normalizedPath}`
    event.node.req.url = `${url.pathname}${url.search}`
  }
})

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function mixHex(a: string, b: string, amount: number): string {
  const aRgb = hexToRgb(a)
  const bRgb = hexToRgb(b)
  if (!aRgb || !bRgb) return a
  const t = Math.max(0, Math.min(1, amount))
  const r = Math.round(aRgb.r * (1 - t) + bRgb.r * t)
  const g = Math.round(aRgb.g * (1 - t) + bRgb.g * t)
  const bl = Math.round(aRgb.b * (1 - t) + bRgb.b * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function derivePrimaryVariants(brandPrimary: string) {
  const primary = brandPrimary
  return {
    primary,
    primary_50: mixHex(primary, '#ffffff', 0.85),
    primary_100: mixHex(primary, '#ffffff', 0.7),
    primary_600: mixHex(primary, '#000000', 0.25),
    primary_700: mixHex(primary, '#000000', 0.35),
  }
}

function deriveTenantThemeFromStyle(cfg: {
  tokens: {
    brandPrimary: string
    textOnPrimary: string
    brandSecondary: string
    brandAccent: string
    surfaceBackground: string
    surfaceCard: string
    textPrimary: string
    textMuted: string
    stateSuccess: string
    stateWarning: string
    stateError: string
  }
}) {
  return {
    ...derivePrimaryVariants(cfg.tokens.brandPrimary),
    on_primary: cfg.tokens.textOnPrimary,
    secondary: cfg.tokens.brandSecondary,
    accent: cfg.tokens.brandAccent,
    surface_background: cfg.tokens.surfaceBackground,
    surface_card: cfg.tokens.surfaceCard,
    text_primary: cfg.tokens.textPrimary,
    text_muted: cfg.tokens.textMuted,
    state_success: cfg.tokens.stateSuccess,
    state_warning: cfg.tokens.stateWarning,
    state_error: cfg.tokens.stateError,
  }
}
