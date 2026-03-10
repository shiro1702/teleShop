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

  // На текущем этапе мини‑приложение работает только как витрина:
  // оформление заказа происходит через веб‑интерфейс, поэтому
  // прячем MainButton и не вешаем на него обработчики.
  hideMainButton()
})
