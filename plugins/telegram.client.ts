import { setOrderContinuationHint } from '~/composables/useTelegram'

export default defineNuxtPlugin(() => {
  const cartStore = useCartStore()
  const { webApp, isTelegram, hideMainButton, expandMessengerViewport } = useTelegram()

  if (!isTelegram.value || !webApp.value) return

  // Если Mini App запущен со start_param (из веб-сайта) — восстановим корзину по токену
  const startParam = webApp.value.initDataUnsafe?.start_param
  console.log('[TMA][Bridge] initDataUnsafe:', webApp.value.initDataUnsafe)
  console.log('[TMA][Bridge] start_param:', startParam)
  if (startParam) {
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
          console.error('[TMA][Bridge] Failed to resolve order token:', err)
        })
      return
    }

    $fetch<{ ok: boolean; shopId?: string | null; scopeKey?: string | null; items: any[] }>('/api/cart-bridge', {
      method: 'GET',
      params: { token: startParam },
    })
      .then((res) => {
        if (res?.ok && Array.isArray(res.items) && res.items.length > 0) {
          const fallbackScopeKey = typeof res.shopId === 'string' && res.shopId.trim()
            ? res.shopId.trim()
            : null
          cartStore.mergeBridgePayload(
            { scopeKey: res.scopeKey || fallbackScopeKey, items: res.items },
            fallbackScopeKey,
          )
          setOrderContinuationHint('web_to_telegram')
          console.log('[TMA][Bridge] Restoring cart from token, items:', res.items.length)
        }
      })
      .catch((err) => {
        console.error('[TMA][Bridge] Failed to restore cart from token:', err)
      })
  }

  webApp.value.ready()
  expandMessengerViewport()
  // По текущему ТЗ в TMA не оформляем заказ и не используем MainButton
  hideMainButton()
})
