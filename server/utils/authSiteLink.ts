/**
 * Извлекает UUID токена из текста сообщения (/start link_<uuid> или link_<uuid>).
 */
export function parseAuthLinkTokenUuidFromText(text: string): string | null {
  const t = text.trim()
  const direct = /^link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(t)
  if (direct) return direct[1]
  const start = /^\/start\s+link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(t)
  if (start) return start[1]
  const embedded = /link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(t)
  return embedded?.[1] ?? null
}

/**
 * Сборка URL страницы завершения входа (link-telegram / link-max) из bridge_payload.link_context.
 */
export type LinkContextPayload = {
  shop_slug?: string
  city_slug?: string
  redirect_path?: string
  custom_domain_hostname?: string | null
}

export function buildAuthSiteLinkUrl(options: {
  linkPath: 'link-telegram' | 'link-max'
  appUrlBase: string
  defaultCitySlug: string
  token: string
  bridgePayload: Record<string, unknown> | null | undefined
  tenantShop?: { slug?: string; custom_domain?: string | null }
}): string {
  const raw = (options.bridgePayload?.link_context || {}) as LinkContextPayload
  const baseApp = options.appUrlBase.replace(/\/$/, '')
  let baseUrl = baseApp
  const host = raw.custom_domain_hostname && String(raw.custom_domain_hostname).trim()
  if (host) {
    const clean = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    baseUrl = `https://${clean}`
  } else {
    const city =
      (raw.city_slug && String(raw.city_slug).trim()) || options.defaultCitySlug
    const shopSlug =
      (raw.shop_slug && String(raw.shop_slug).trim()) ||
      (options.tenantShop?.slug && String(options.tenantShop.slug).trim()) ||
      ''
    if (shopSlug) {
      baseUrl = `${baseApp}/${encodeURIComponent(city)}/${encodeURIComponent(shopSlug)}`
    }
  }
  const redirectPath =
    typeof raw.redirect_path === 'string' && raw.redirect_path.startsWith('/') && !raw.redirect_path.startsWith('//')
      ? raw.redirect_path
      : '/checkout?step=1'
  const shopId =
    (raw.shop_slug && String(raw.shop_slug).trim()) ||
    (options.tenantShop?.slug && String(options.tenantShop.slug).trim()) ||
    ''
  const q = new URLSearchParams()
  q.set('token', options.token)
  q.set('redirect', redirectPath)
  if (shopId) q.set('shop_id', shopId)
  return `${baseUrl}/${options.linkPath}?${q.toString()}`
}
