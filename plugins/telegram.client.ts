function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

export default defineNuxtPlugin(() => {
  const { webApp, isTelegram, hideMainButton } = useTelegram()

  if (!isTelegram.value || !webApp.value) return

  webApp.value.ready()
  // По текущему ТЗ в TMA не оформляем заказ и не используем MainButton
  hideMainButton()
})
