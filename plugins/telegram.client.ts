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
      const text = `Корзина: ${cartStore.count} шт. на ${formatPrice(cartStore.total)}`
      showMainButton(text)

      if (!mainButtonClickHandler) {
        mainButtonClickHandler = () => {
          cartStore.openCartModal()
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
  cartStore.$subscribe(() => {
    updateMainButton()
  })
})
