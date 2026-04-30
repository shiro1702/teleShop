import { setOrderContinuationHint } from '~/composables/useTelegram'
import { watch } from 'vue'

export default defineNuxtPlugin(() => {
  const { expandMessengerViewport, isMaxMiniApp, messengerWebApp } = useTelegram()

  function runMaxCartBridge() {
    const wa = window.WebApp
    if (!wa?.initData) return
    if (window.Telegram?.WebApp?.initData) return

    if (typeof wa.ready === 'function') wa.ready()

    const cartStore = useCartStore()
    const startParam = wa.initDataUnsafe?.start_param
    if (!startParam) return

    if (startParam.startsWith('order_')) {
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

  // Если скрипт уже загружен
  if (isMaxMiniApp.value && window.WebApp?.initData) {
    expandMessengerViewport()
    runMaxCartBridge()
  } else {
    // Ждём загрузки скрипта
    const unwatch = watch(messengerWebApp, (wa) => {
      if (isMaxMiniApp.value && wa) {
        expandMessengerViewport()
        runMaxCartBridge()
        unwatch()
      }
    })
    
    setTimeout(() => {
      unwatch()
    }, 5000)
  }
})
