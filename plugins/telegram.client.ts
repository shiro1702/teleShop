export default defineNuxtPlugin(() => {
  const cartStore = useCartStore()
  const { webApp, isTelegram, hideMainButton } = useTelegram()

  if (!isTelegram.value || !webApp.value) return

  // Если Mini App запущен со start_param (из веб-сайта) — восстановим корзину по токену
  const startParam = webApp.value.initDataUnsafe?.start_param
  console.log('[TMA][Bridge] initDataUnsafe:', webApp.value.initDataUnsafe)
  console.log('[TMA][Bridge] start_param:', startParam)
  if (startParam) {
    $fetch<{ ok: boolean; items: any[] }>('/api/cart-bridge', {
      method: 'GET',
      params: { token: startParam },
    })
      .then((res) => {
        if (res?.ok && Array.isArray(res.items) && res.items.length > 0) {
          console.log('[TMA][Bridge] Restoring cart from token, items:', res.items.length)
          cartStore.clear()
          res.items.forEach((item) => {
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
        console.error('[TMA][Bridge] Failed to restore cart from token:', err)
      })
  }

  webApp.value.ready()
  // По текущему ТЗ в TMA не оформляем заказ и не используем MainButton
  hideMainButton()
})
