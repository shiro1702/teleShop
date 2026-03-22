import { computed } from 'vue'
import { useRoute } from 'vue-router'

type TenantTheme = Record<string, string>
type TenantState = {
  loaded: boolean
  loading: boolean
  shopId: string | null
  tenantSlug: string | null
  shopName: string | null
  theme: TenantTheme
  isCustomDomain: boolean
  logoUrl: string | null
  description: string | null
}

function normalizeTheme(input: unknown): TenantTheme {
  if (!input || typeof input !== 'object') return {}
  const out: TenantTheme = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

function getStringSetting(input: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!input) return null
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function buildCssVars(theme: TenantTheme): Record<string, string> {
  const vars: Record<string, string> = {}
  const mapping: Record<string, string> = {
    primary: '--color-primary',
    primary_50: '--color-primary-50',
    primary_100: '--color-primary-100',
    primary_600: '--color-primary-600',
    primary_700: '--color-primary-700',
  }

  for (const [key, value] of Object.entries(theme)) {
    vars[`--tenant-${key}`] = value
    const cssVar = mapping[key]
    if (cssVar) {
      vars[cssVar] = value
    }
  }

  return vars
}

export function useTenant() {
  const route = useRoute()
  const event = import.meta.server ? useRequestEvent() : null
  const state = useState<TenantState>('tenant-state', () => ({
    loaded: false,
    loading: false,
    shopId: null,
    tenantSlug: null,
    shopName: null,
    theme: {},
    isCustomDomain: false,
    logoUrl: null,
    description: null,
  }))

  function applyTenant(payload: {
    shopId?: string | null
    tenantSlug?: string | null
    shop?: { name?: string | null; slug?: string | null } | null
    uiSettings?: Record<string, unknown> | null
    isCustomDomain?: boolean
  }) {
    state.value.shopId = payload.shopId ?? null
    state.value.tenantSlug = payload.tenantSlug ?? payload.shop?.slug ?? state.value.tenantSlug ?? null
    state.value.shopName = payload.shop?.name ?? state.value.shopName ?? null
    const normalizedTheme = normalizeTheme(payload.uiSettings)
    state.value.theme = normalizedTheme
    state.value.isCustomDomain = !!payload.isCustomDomain
    state.value.logoUrl = getStringSetting(payload.uiSettings ?? null, 'logo_url', 'logoUrl')
    state.value.description = getStringSetting(payload.uiSettings ?? null, 'description', 'shop_description', 'shopDescription')
    state.value.loaded = true
    state.value.loading = false
  }

  if (import.meta.server && event?.context?.tenant && !state.value.loaded) {
    applyTenant({
      shopId: event.context.tenant.shopId,
      tenantSlug: event.context.tenant.shop.slug,
      shop: {
        name: event.context.tenant.shop.name,
        slug: event.context.tenant.shop.slug,
      },
      uiSettings: event.context.tenant.uiSettings,
      isCustomDomain: !!event.context.tenant.isCustomDomain,
    })
  }

  const routeTenantSlug = computed(() =>
    typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug : null,
  )

  const tenantKey = computed(() =>
    state.value.tenantSlug
    || routeTenantSlug.value
    || state.value.shopId
    || (typeof route.query.shop_id === 'string' ? route.query.shop_id : null),
  )

  const routePrefix = computed(() => {
    const slug = state.value.tenantSlug || routeTenantSlug.value
    if (!slug || state.value.isCustomDomain) return ''
    return `/${slug}`
  })

  const cssVars = computed<Record<string, string>>(() => {
    return buildCssVars(state.value.theme)
  })

  function tenantPath(path = '/') {
    const normalized = path.startsWith('/') ? path : `/${path}`
    if (normalized === '/') {
      return routePrefix.value || '/'
    }
    return `${routePrefix.value}${normalized}`
  }

  async function loadTenantSettings() {
    if (state.value.loading || state.value.loaded) return
    state.value.loading = true
    try {
      const tenantRef = tenantKey.value || undefined
      const query = tenantRef ? { shop_id: tenantRef } : undefined
      const res = await $fetch<{
        ok: boolean
        shopId: string
        tenantSlug?: string
        isCustomDomain?: boolean
        shop?: { name?: string }
        uiSettings?: Record<string, unknown>
      }>('/api/tenant', {
        query,
        headers: tenantRef ? { 'x-shop-id': tenantRef } : undefined,
      })
      if (res?.ok) {
        applyTenant(res)
      }
    } finally {
      if (!state.value.loaded) {
        state.value.loaded = true
        state.value.loading = false
      }
    }
  }

  return {
    tenant: state,
    tenantKey,
    routePrefix,
    tenantPath,
    cssVars,
    loadTenantSettings,
  }
}
