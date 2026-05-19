import { useTelegram } from '~/composables/useTelegram'

/** Нормализует ответ MAX DeviceStorage / Telegram CloudStorage. */
export function parseMessengerStorageValue(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.value === 'string') return o.value
  if (o.value === null) return null
  return null
}

/**
 * Облако Telegram CloudStorage vs MAX DeviceStorage — единый async API для ключей checkout/адресов.
 */
export function useMessengerStorage() {
  const { isTelegram, isMaxMiniApp } = useTelegram()

  function canUseMessengerStorage(): boolean {
    if (!process.client) return false
    if (isTelegram.value && window.Telegram?.WebApp?.CloudStorage) {
      return true
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      return true
    }
    return false
  }

  async function setItem(key: string, value: string): Promise<void> {
    const tg = window.Telegram?.WebApp
    if (isTelegram.value && tg?.CloudStorage) {
      try {
        await new Promise<void>((resolve) => {
          ;(tg as any).CloudStorage.setItem(key, value, (err: unknown) => {
            if (err) {
              console.warn('[messengerStorage] CloudStorage.setItem failed', err)
            }
            resolve()
          })
        })
      } catch (err) {
        console.warn('[messengerStorage] CloudStorage.setItem threw', err)
      }
      return
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      try {
        await window.WebApp.DeviceStorage.setItem(key, value)
      } catch (err) {
        console.warn('[messengerStorage] DeviceStorage.setItem failed', err)
      }
    }
  }

  async function getItem(key: string): Promise<string | null> {
    const tg = window.Telegram?.WebApp
    if (isTelegram.value && tg?.CloudStorage) {
      return new Promise((resolve) => {
        ;(tg as any).CloudStorage.getItem(key, (_err: unknown, v: string | null) => {
          resolve(v ?? null)
        })
      })
    }
    if (isMaxMiniApp.value && window.WebApp?.DeviceStorage) {
      try {
        const res = await window.WebApp.DeviceStorage.getItem(key)
        return parseMessengerStorageValue(res)
      } catch (err) {
        console.warn('[messengerStorage] DeviceStorage.getItem failed', err)
        return null
      }
    }
    return null
  }

  return {
    canUseMessengerStorage,
    setItem,
    getItem,
  }
}
