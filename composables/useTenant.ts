import { computed, watch } from 'vue'
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
  legalName: string | null
  inn: string | null
  ogrn: string | null
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
    on_primary: '--color-on-primary',
    secondary: '--color-secondary',
    accent: '--color-accent',
    surface_background: '--color-surface-bg',
    surface_card: '--color-surface-card',
    text_primary: '--color-text-primary',
    text_muted: '--color-text-muted',
    state_success: '--color-success',
    state_warning: '--color-warning',
    state_error: '--color-error',
    radius_button: '--radius-button',
    radius_modal: '--radius-modal',
    radius_input: '--radius-input',
    radius_card: '--radius-card',
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

const GLOBAL_THEME_VAR_KEYS = [
  '--color-primary',
  '--color-primary-50',
  '--color-primary-100',
  '--color-primary-600',
  '--color-primary-700',
  '--color-on-primary',
  '--color-secondary',
  '--color-accent',
  '--color-surface-bg',
  '--color-surface-card',
  '--color-text-primary',
  '--color-text-muted',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--radius-button',
  '--radius-modal',
  '--radius-input',
  '--radius-card',
] as const

export function useTenant() {
  const route = useRoute()
  const isDashboardRoute = computed(() => {
    const routePath = typeof route.path === 'string' ? route.path : ''
    if (routePath.startsWith('/dashboard')) return true
    if (import.meta.client) {
      return window.location.pathname.startsWith('/dashboard')
    }
    return false
  })
  const isNonTenantRoute = computed(() => {
    const routePath = typeof route.path === 'string' ? route.path : ''
    const nonTenantPrefixes = [
      '/dashboard',
      '/onboarding',
      '/login',
      '/register',
      '/profile',
      '/partners',
      '/platform',
      '/link-telegram',
    ]
    return nonTenantPrefixes.some((prefix) => routePath.startsWith(prefix))
  })

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
    legalName: null,
    inn: null,
    ogrn: null,
  }))

  function applyTenant(payload: {
    shopId?: string | null
    tenantSlug?: string | null
    shop?: { name?: string | null; slug?: string | null; legalName?: string | null; inn?: string | null; ogrn?: string | null } | null
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
    state.value.legalName = typeof payload.shop?.legalName === 'string' ? payload.shop.legalName : null
    state.value.inn = typeof payload.shop?.inn === 'string' ? payload.shop.inn : null
    state.value.ogrn = typeof payload.shop?.ogrn === 'string' ? payload.shop.ogrn : null
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
        legalName: event.context.tenant.shop.legal_name ?? null,
        inn: event.context.tenant.shop.inn ?? null,
        ogrn: event.context.tenant.shop.ogrn ?? null,
      },
      uiSettings: event.context.tenant.uiSettings,
      isCustomDomain: !!event.context.tenant.isCustomDomain,
    })
    // MVP: серверный tenant-контекст может не содержать все derived-настройки
    // (например, primary/описание/лого, подмешанные из organization_style_settings).
    // Поэтому форсим повторную загрузку через `/api/tenant`.
    state.value.loaded = false
    state.value.loading = false
  }

  const routeTenantSlug = computed(() =>
    typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug : null,
  )

  const routeCitySlug = computed(() =>
    typeof route.params.city_slug === 'string' ? route.params.city_slug : null,
  )

  const tenantKey = computed(() =>
    // Витрина ресторана SPA-навигация: приоритет должен быть у URL.
    // Иначе tenantKey может не измениться (из-за tenantSlug в state),
    // и тогда мы не перезагрузим theme/настройки нового ресторана.
    state.value.isCustomDomain
      ? (state.value.shopId
          || state.value.tenantSlug
          || (typeof route.query.shop_id === 'string' ? route.query.shop_id : null))
      : (routeTenantSlug.value
          || state.value.shopId
          || state.value.tenantSlug
          || (typeof route.query.shop_id === 'string' ? route.query.shop_id : null)),
  )

  const routePrefix = computed(() => {
    const slug = routeTenantSlug.value || state.value.tenantSlug
    if (!slug || state.value.isCustomDomain) return ''

    // Публичная restaurant-схема агрегатора: /{city_slug}/{tenant_slug}
    if (routeCitySlug.value) return `/${routeCitySlug.value}/${slug}`
    return `/${slug}`
  })

  const cssVars = computed<Record<string, string>>(() => {
    return buildCssVars(state.value.theme)
  })

  // Для элементов, которые рендерятся вне `.app-root` (например через `Teleport` в `body`),
  // CSS-переменные не наследуются. Синхронизируем их на `document.documentElement`,
  // чтобы `Tailwind colors` через `var(--color-primary*)` работали везде.
  if (typeof window !== 'undefined') {
    watch(
      cssVars,
      (vars) => {
        for (const key of GLOBAL_THEME_VAR_KEYS) {
          document.documentElement.style.removeProperty(key)
        }
        for (const [key, value] of Object.entries(vars)) {
          document.documentElement.style.setProperty(key, value)
        }
      },
      { immediate: true },
    )
  }

  function tenantPath(path = '/') {
    const normalized = path.startsWith('/') ? path : `/${path}`
    if (normalized === '/') {
      return routePrefix.value || '/'
    }
    return `${routePrefix.value}${normalized}`
  }

  async function loadTenantSettings() {
    if (state.value.loading || state.value.loaded) return
    const explicitTenantFromQuery = typeof route.query.shop_id === 'string' && route.query.shop_id.trim()
      ? route.query.shop_id.trim()
      : ''
    if ((isDashboardRoute.value || isNonTenantRoute.value) && !explicitTenantFromQuery) {
      state.value.loaded = true
      state.value.loading = false
      return
    }
    state.value.loading = true
    try {
      const tenantRef = tenantKey.value || undefined
      const query = tenantRef ? { shop_id: tenantRef } : undefined
      const res = await $fetch<{
        ok: boolean
        shopId: string
        tenantSlug?: string
        isCustomDomain?: boolean
        shop?: { name?: string; legalName?: string | null; inn?: string | null; ogrn?: string | null }
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

  // При клиентском переходе между ресторанами (NuxtLink) нужно перезагружать tenant-данные.
  watch(
    tenantKey,
    async (key, prev) => {
      if (!key || key === prev) return
      state.value.loaded = false
      // Сбрасываем старый контекст, чтобы UI и запросы к API не использовали
      // tenantSlug/shopId предыдущего ресторана до загрузки новых данных.
      state.value.tenantSlug = null
      state.value.shopId = null
      state.value.shopName = null
      state.value.logoUrl = null
      state.value.description = null
      state.value.legalName = null
      state.value.inn = null
      state.value.ogrn = null
      state.value.theme = {}
      try {
        await loadTenantSettings()
      } finally {
        // Если загрузка не удалась — оставим default theme, но сбросим loading флаг.
        state.value.loading = false
      }
    },
    { immediate: false },
  )

  return {
    tenant: state,
    tenantKey,
    routePrefix,
    tenantPath,
    cssVars,
    loadTenantSettings,
  }
}
