import { setOrderContinuationHint } from '~/composables/useTelegram'
import { watch, unref } from 'vue'

export default defineNuxtPlugin(() => {
  const cartStore = useCartStore()
  const { webApp, isTelegram, hideMainButton, expandMessengerViewport } = useTelegram()

  const runTelegramBridge = () => {
    const wa = unref(webApp)
    if (!unref(isTelegram) || !wa) return

    // Если Mini App запущен со start_param (из веб-сайта) — восстановим корзину по токену
    const startParam = wa.initDataUnsafe?.start_param
    console.log('[TMA][Bridge] initDataUnsafe:', wa.initDataUnsafe)
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

    wa.ready()
    expandMessengerViewport()
    // По текущему ТЗ в TMA не оформляем заказ и не используем MainButton
    hideMainButton()
  }

  if (isTelegram.value && webApp.value) {
    runTelegramBridge()
  } else {
    // Ждём, пока скрипт загрузится и webApp станет доступен
    const unwatch = watch(webApp, (wa) => {
      if (isTelegram.value && wa) {
        runTelegramBridge()
        unwatch()
      }
    })
    
    // Также снимаем вотчер через 5 секунд, если не загрузилось
    setTimeout(() => {
      unwatch()
    }, 5000)
  }
})
