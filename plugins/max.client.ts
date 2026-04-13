import { setOrderContinuationHint } from '~/composables/useTelegram'

function runMaxCartBridge() {
  const wa = window.WebApp
  if (!wa?.initData) return
  if (window.Telegram?.WebApp?.initData) return

  if (typeof wa.ready === 'function') wa.ready()

  const cartStore = useCartStore()
  const startParam = wa.initDataUnsafe?.start_param
  if (!startParam) return

  $fetch<{ ok: boolean; shopId?: string | null; items: unknown[] }>('/api/cart-bridge', {
    method: 'GET',
    params: { token: startParam },
  })
    .then((res) => {
      if (res?.ok && Array.isArray(res.items) && res.items.length > 0) {
        if (typeof res.shopId === 'string' && res.shopId.trim()) {
          cartStore.setScope(res.shopId.trim())
        }
        setOrderContinuationHint('web_to_max')
        cartStore.clear()
        res.items.forEach((item: any) => {
          cartStore.addItem(
            {
              id: item.id,
              name: item.name,
              price: item.price,
              image: item.image,
              description: item.description ?? undefined,
              category: item.category,
            },
            item.quantity,
          )
        })
      }
    })
    .catch((err) => {
      console.error('[MAX][Bridge] Failed to restore cart from token:', err)
    })
}

export default defineNuxtPlugin(() => {
  runMaxCartBridge()
  queueMicrotask(runMaxCartBridge)
  setTimeout(runMaxCartBridge, 0)
})
