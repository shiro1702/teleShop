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
  const { webApp, isTelegram, showMainButton, hideMainButton, onMainButtonClick, offMainButtonClick } =
    useTelegram()

  if (!isTelegram.value || !webApp.value) return

  webApp.value.ready()

  let mainButtonClickHandler: (() => void) | null = null

  function updateMainButton() {
    const hasItems = cartStore.items.length > 0
    if (hasItems) {
      showMainButton(`Оформить заказ на ${formatPrice(cartStore.total)}`)

      if (!mainButtonClickHandler) {
        mainButtonClickHandler = async () => {
          if (!webApp.value) return
          webApp.value.MainButton.showProgress(true)
          try {
            const res = await $fetch<{ ok: boolean }>('/api/order', {
              method: 'POST',
              body: {
                items: cartStore.items,
                initData: webApp.value.initData,
              } satisfies { items: CartItem[]; initData: string },
            })
            if (res?.ok) {
              cartStore.clear()
              webApp.value.showAlert('Заказ оформлен!')
              webApp.value.close()
            } else {
              webApp.value.showAlert('Не удалось оформить заказ. Попробуйте ещё раз.')
            }
          } catch {
            webApp.value.showAlert('Ошибка при отправке заказа. Проверьте соединение.')
          } finally {
            webApp.value.MainButton.showProgress(false)
          }
        }
        onMainButtonClick(mainButtonClickHandler)
      }
    } else {
      hideMainButton()
      if (mainButtonClickHandler) {
        offMainButtonClick(mainButtonClickHandler)
        mainButtonClickHandler = null
      }
    }
  }

  updateMainButton()
  cartStore.$subscribe(updateMainButton)
})
