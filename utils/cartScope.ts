type RouteLike = {
  path?: string
  params?: Record<string, unknown>
  query?: Record<string, unknown>
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const found = value.find((x): x is string => typeof x === 'string' && !!x.trim())
    if (found) return found.trim()
  }
  return null
}

/** shop_id / shopId из query — для API и миграции legacy-ключа корзины. */
export function readShopIdFromQuery(route: RouteLike): string | null {
  return readString(route.query?.shop_id) || readString(route.query?.shopId)
}

/**
 * То же, что синхронная часть shopIdFromRoute на чекауте/витрине:
 * slug ресторана из маршрута или shop_id в query (без async useTenant).
 */
export function shopIdLikeForCartScope(route: RouteLike): string | null {
  return readString(route.params?.tenant_slug) || readShopIdFromQuery(route) || null
}

/** Путь для разбора city/tenant: сначала route, на клиенте fallback на location (гидрация). */
function pathForCartScope(route: RouteLike): string {
  const fromRoute = readString(route.path)
  if (fromRoute && fromRoute !== '/') return fromRoute
  if (typeof window !== 'undefined') {
    const loc = window.location?.pathname
    if (typeof loc === 'string' && loc.trim() && loc !== '/') return loc.trim()
  }
  return fromRoute || ''
}

export function resolveCartScopeKey(route: RouteLike, tenantKey?: string | null): string | null {
  // Сначала магазин по пути агрегатора /{city}/{tenant}/... — тот же ключ, что и на витрине.
  // Важно: иначе /city/tenant/checkout?shop_id=UUID даёт другой ключ, чем без query
  // (корзина «пропадает» при refresh и после auth bridge, где в query дописывается shop_id).
  const tenantSlug = readString(route.params?.tenant_slug)
  if (tenantSlug) {
    const citySlug = readString(route.params?.city_slug)
    return citySlug ? `${citySlug}/${tenantSlug}` : tenantSlug
  }

  // То же по path, если params ещё не готовы (на клиенте подмешиваем location.pathname).
  const path = pathForCartScope(route)
  if (path) {
    const [first, second] = path.split('/').filter(Boolean)
    const reserved = ['cart', 'checkout', 'dashboard', 'login', 'register', 'onboarding', 'profile']
    if (first && second && !reserved.includes(first) && !reserved.includes(second)) {
      return `${first}/${second}`
    }
    if (first && !reserved.includes(first)) {
      return first
    }
  }

  // Глубокие ссылки без сегментов city/tenant в пути — тогда shop_id в query.
  const byShopIdQuery = readString(route.query?.shop_id) || readString(route.query?.shopId)
  if (byShopIdQuery) return byShopIdQuery

  const byTenantKey = readString(tenantKey)
  if (byTenantKey) return byTenantKey

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `host:${window.location.hostname}`
  }

  return null
}
