import { setOrderContinuationHint } from '~/composables/useTelegram'

const MAX_BRIDGE_TOKEN_CACHE_KEY = 'teleshop_max_bridge_token'

function readStartParamFromLocation(): string {
  if (!process.client) return ''
  try {
    const search = new URLSearchParams(window.location.search)
    const fromSearch = search.get('startapp') || search.get('start_param') || ''
    if (fromSearch.trim()) return fromSearch.trim()

    const hashRaw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    if (!hashRaw) return ''
    const hashParams = new URLSearchParams(hashRaw)
    const fromHash = hashParams.get('startapp') || hashParams.get('start_param') || ''
    return fromHash.trim()
  } catch {
    return ''
  }
}

function isStartParamAlreadyHandled(startParam: string): boolean {
  if (!process.client) return false
  try {
    return sessionStorage.getItem(MAX_BRIDGE_TOKEN_CACHE_KEY) === startParam
  } catch {
    return false
  }
}

function markStartParamHandled(startParam: string) {
  if (!process.client) return
  try {
    sessionStorage.setItem(MAX_BRIDGE_TOKEN_CACHE_KEY, startParam)
  } catch {
    // ignore storage errors
  }
}

function runMaxCartBridge() {
  const wa = window.WebApp
  if (!wa?.initData) return

  if (typeof wa.ready === 'function') wa.ready()

  const cartStore = useCartStore()
  const startParam = String(wa.initDataUnsafe?.start_param || readStartParamFromLocation()).trim()
  if (!startParam) return
  if (isStartParamAlreadyHandled(startParam)) return

  if (startParam.startsWith('order_')) {
    markStartParamHandled(startParam)
    $fetch<{ ok: boolean; orderId?: string; shopId?: string }>('/api/order-bridge', {
      method: 'GET',
      params: { token: startParam },
    })
      .then((res) => {
        if (!res?.ok || !res.orderId) return
        const query = new URLSearchParams({ orderId: res.orderId })
        if (typeof res.shopId === 'string' && res.shopId.trim()) query.set('shop_id', res.shopId.trim())
        void navigateTo(`/orders?${query.toString()}`)
      })
      .catch((err) => {
        console.error('[MAX][Bridge] Failed to resolve order token:', err)
      })
    return
  }

  markStartParamHandled(startParam)
  $fetch<{ ok: boolean; shopId?: string | null; scopeKey?: string | null; items: unknown[] }>('/api/cart-bridge', {
    method: 'GET',
    params: { token: startParam },
  })
    .then((res) => {
      if (res?.ok && Array.isArray(res.items) && res.items.length > 0) {
        const fallbackScopeKey = typeof res.shopId === 'string' && res.shopId.trim()
          ? res.shopId.trim()
          : null
        cartStore.mergeBridgePayload(
          { scopeKey: res.scopeKey || fallbackScopeKey, items: res.items as any[] },
          fallbackScopeKey,
        )
        setOrderContinuationHint('web_to_max')
      }
    })
    .catch((err) => {
      console.error('[MAX][Bridge] Failed to restore cart from token:', err)
    })
}

export default defineNuxtPlugin(() => {
  const { expandMessengerViewport } = useTelegram()
  expandMessengerViewport()
  runMaxCartBridge()
  queueMicrotask(runMaxCartBridge)
  setTimeout(runMaxCartBridge, 0)
})
