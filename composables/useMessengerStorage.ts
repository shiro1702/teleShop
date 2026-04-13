import { useTelegram } from '~/composables/useTelegram'

/**
 * Облако Telegram CloudStorage vs MAX DeviceStorage — единый async API для ключей checkout/адресов.
 */
export function useMessengerStorage() {
  const { isTelegram, isMaxMiniApp, webApp } = useTelegram()

  function canUseMessengerStorage(): boolean {
    if (!process.client) return false
    if (isTelegram.value && (webApp.value as { CloudStorage?: unknown } | null)?.CloudStorage) {
      return true
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      return true
    }
    return false
  }

  async function setItem(key: string, value: string): Promise<void> {
    if (isTelegram.value && (webApp.value as any)?.CloudStorage) {
      await new Promise<void>((resolve) => {
        ;(webApp.value as any).CloudStorage.setItem(key, value, () => resolve())
      })
      return
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      await window.WebApp.DeviceStorage.setItem(key, value)
    }
  }

  async function getItem(key: string): Promise<string | null> {
    if (isTelegram.value && (webApp.value as any)?.CloudStorage) {
      return new Promise((resolve) => {
        ;(webApp.value as any).CloudStorage.getItem(key, (_err: unknown, v: string | null) => {
          resolve(v ?? null)
        })
      })
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      const res = await window.WebApp.DeviceStorage.getItem(key)
      if (res && typeof res.value === 'string') return res.value
      return null
    }
    return null
  }

  return {
    canUseMessengerStorage,
    setItem,
    getItem,
  }
}
