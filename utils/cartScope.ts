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

export function resolveCartScopeKey(route: RouteLike, tenantKey?: string | null): string | null {
  const byTenantKey = readString(tenantKey)
  if (byTenantKey) return byTenantKey

  const byShopIdQuery = readString(route.query?.shop_id) || readString(route.query?.shopId)
  if (byShopIdQuery) return byShopIdQuery

  const tenantSlug = readString(route.params?.tenant_slug)
  if (tenantSlug) {
    const citySlug = readString(route.params?.city_slug)
    return citySlug ? `${citySlug}/${tenantSlug}` : tenantSlug
  }

  const path = readString(route.path) || ''
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

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `host:${window.location.hostname}`
  }

  return null
}
