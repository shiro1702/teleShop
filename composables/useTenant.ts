import { computed } from 'vue'
import { useRoute } from 'vue-router'

type TenantTheme = Record<string, string>
type TenantState = {
  loaded: boolean
  loading: boolean
  shopId: string | null
  shopName: string | null
  theme: TenantTheme
}

function normalizeTheme(input: unknown): TenantTheme {
  if (!input || typeof input !== 'object') return {}
  const out: TenantTheme = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

export function useTenant() {
  const route = useRoute()
  const state = useState<TenantState>('tenant-state', () => ({
    loaded: false,
    loading: false,
    shopId: null,
    shopName: null,
    theme: {},
  }))

  const cssVars = computed<Record<string, string>>(() => {
    const vars: Record<string, string> = {}
    for (const [key, value] of Object.entries(state.value.theme)) {
      vars[`--tenant-${key}`] = value
    }
    return vars
  })

  async function loadTenantSettings() {
    if (state.value.loading) return
    state.value.loading = true
    try {
      const shopId = typeof route.query.shop_id === 'string' ? route.query.shop_id : undefined
      const query = shopId ? { shop_id: shopId } : undefined
      const res = await $fetch<{
        ok: boolean
        shopId: string
        shop?: { name?: string }
        uiSettings?: Record<string, unknown>
      }>('/api/tenant', { query })
      if (res?.ok) {
        state.value.shopId = res.shopId
        state.value.shopName = res.shop?.name ?? null
        state.value.theme = normalizeTheme(res.uiSettings)
      }
    } finally {
      state.value.loaded = true
      state.value.loading = false
    }
  }

  return {
    tenant: state,
    cssVars,
    loadTenantSettings,
  }
}
