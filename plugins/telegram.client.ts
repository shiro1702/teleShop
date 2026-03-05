import type { CartItem } from '~/stores/cart'

function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

export default defineNuxtPlugin(() => {
  const cartStore = useCartStore()
  const WebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

  if (!WebApp) return

  WebApp.ready()

  let mainButtonClickHandler: (() => void) | null = null

  function updateMainButton() {
    const hasItems = cartStore.items.length > 0
    if (hasItems) {
      WebApp!.MainButton.setText(`Оформить заказ на ${formatPrice(cartStore.total)}`)
      WebApp!.MainButton.show()

      if (!mainButtonClickHandler) {
        mainButtonClickHandler = async () => {
          WebApp!.MainButton.showProgress(true)
          try {
            const res = await $fetch<{ ok: boolean }>('/api/order', {
              method: 'POST',
              body: {
                items: cartStore.items,
                initData: WebApp!.initData,
              } satisfies { items: CartItem[]; initData: string },
            })
            if (res?.ok) {
              cartStore.clear()
              WebApp!.showAlert('Заказ оформлен!')
              WebApp!.close()
            } else {
              WebApp!.showAlert('Не удалось оформить заказ. Попробуйте ещё раз.')
            }
          } catch {
            WebApp!.showAlert('Ошибка при отправке заказа. Проверьте соединение.')
          } finally {
            WebApp!.MainButton.showProgress(false)
          }
        }
        WebApp!.MainButton.onClick(mainButtonClickHandler)
      }
    } else {
      WebApp!.MainButton.hide()
    }
  }

  updateMainButton()
  cartStore.$subscribe(updateMainButton)
})
