import { computed } from 'vue'

export function useTelegram() {
  const isClient = process.client

  const isTelegram = computed(() => {
    if (!isClient) return false
    // @ts-expect-error: Telegram WebApp может быть не объявлен
    const webApp = window.Telegram?.WebApp
    return typeof webApp !== 'undefined' && !!webApp.initData
  })

  const webApp = computed(() => {
    if (!isClient) return null
    // @ts-expect-error: Telegram WebApp может быть не объявлен
    return window.Telegram?.WebApp ?? null
  })

  function showMainButton(text: string) {
    if (!webApp.value) return
    webApp.value.MainButton.text = text
    webApp.value.MainButton.show()
  }

  function hideMainButton() {
    if (!webApp.value) return
    webApp.value.MainButton.hide()
  }

  function onMainButtonClick(handler: () => void) {
    if (!webApp.value) return
    webApp.value.MainButton.onClick(handler)
  }

  function offMainButtonClick(handler: () => void) {
    if (!webApp.value) return
    webApp.value.MainButton.offClick(handler)
  }

  function cardClass(baseWeb: string): string {
    return isTelegram.value ? 'tg-card' : baseWeb
  }

  function buttonClass(baseWeb: string): string {
    return isTelegram.value ? 'tg-button tg-button-text' : baseWeb
  }

  function textClass(baseWeb: string): string {
    return isTelegram.value ? 'tg-text' : baseWeb
  }

  function mutedTextClass(baseWeb: string): string {
    return isTelegram.value ? 'tg-text-muted' : baseWeb
  }

  return {
    isTelegram,
    webApp,
    showMainButton,
    hideMainButton,
    onMainButtonClick,
    offMainButtonClick,
    cardClass,
    buttonClass,
    textClass,
    mutedTextClass,
  }
}

