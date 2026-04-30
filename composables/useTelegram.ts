import { computed, ref, onMounted } from 'vue'

const BRIDGE_CONTINUATION_KEY = 'teleshop_order_continuation'

export type MessengerClientChannel = 'web' | 'telegram_mini' | 'max_mini'
export type OrderContinuationHint = 'web_to_telegram' | 'web_to_max' | null

// Глобальный триггер для обновления computed-свойств после асинхронной загрузки скриптов
const messengerScriptsLoadedTrigger = ref(0)

// Функция для запуска поллинга загрузки скриптов
function startMessengerScriptsPolling() {
  if (!process.client) return
  let attempts = 0
  const interval = setInterval(() => {
    attempts++
    let updated = false
    if (window.Telegram?.WebApp?.initData) {
      updated = true
    }
    if (window.WebApp?.initData) {
      updated = true
    }
    if (updated || attempts > 50) { // 5 секунд
      messengerScriptsLoadedTrigger.value++
      if (updated) clearInterval(interval)
      if (attempts > 50) clearInterval(interval)
    }
  }, 100)
}

if (process.client) {
  startMessengerScriptsPolling()
}

export function readOrderContinuationHint(): OrderContinuationHint {
  if (!process.client) return null
  try {
    const raw = sessionStorage.getItem(BRIDGE_CONTINUATION_KEY)
    if (raw === 'web_to_telegram' || raw === 'web_to_max') return raw
  } catch {
    // ignore
  }
  return null
}

export function clearOrderContinuationHint() {
  if (!process.client) return
  try {
    sessionStorage.removeItem(BRIDGE_CONTINUATION_KEY)
  } catch {
    // ignore
  }
}

export function setOrderContinuationHint(hint: OrderContinuationHint) {
  if (!process.client || !hint) return
  try {
    sessionStorage.setItem(BRIDGE_CONTINUATION_KEY, hint)
  } catch {
    // ignore
  }
}

export function useTelegram() {
  const isClient = process.client

  function readInitDataFromUrl(): string {
    if (!isClient) return ''
    try {
      const candidates: string[] = []
      const search = new URLSearchParams(window.location.search)
      candidates.push(
        search.get('tgWebAppData') || '',
        search.get('initData') || '',
      )

      const hashRaw = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      if (hashRaw) {
        const hashParams = new URLSearchParams(hashRaw)
        candidates.push(
          hashParams.get('tgWebAppData') || '',
          hashParams.get('initData') || '',
        )
      }

      for (const raw of candidates) {
        const trimmed = raw.trim()
        if (!trimmed) continue
        try {
          return decodeURIComponent(trimmed)
        } catch {
          return trimmed
        }
      }
      return ''
    } catch {
      return ''
    }
  }

  const isTelegram = computed(() => {
    messengerScriptsLoadedTrigger.value
    if (!isClient) return false
    // @ts-ignore: Telegram WebApp может быть не объявлен
    const webApp = window.Telegram?.WebApp
    if (typeof webApp !== 'undefined' && !!webApp.initData) return true
    
    // Синхронная проверка по URL для предотвращения моргания UI
    const search = new URLSearchParams(window.location.search)
    const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(hashRaw)
    return search.has('tgWebAppData') || hashParams.has('tgWebAppData')
  })

  /** MAX мини-приложение: глобальный window.WebApp с initData (не пересекается с Telegram.WebApp). */
  const isMaxMiniApp = computed(() => {
    messengerScriptsLoadedTrigger.value
    if (!isClient) return false
    if (window.Telegram?.WebApp?.initData) return false
    if (typeof window.WebApp !== 'undefined' && !!window.WebApp?.initData) return true
    
    // Синхронная проверка по URL для предотвращения моргания UI
    // Если есть initData, но нет tgWebAppData, считаем, что это MAX
    const search = new URLSearchParams(window.location.search)
    const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(hashRaw)
    const hasInitData = search.has('initData') || hashParams.has('initData')
    const hasTgData = search.has('tgWebAppData') || hashParams.has('tgWebAppData')
    return hasInitData && !hasTgData
  })

  const isMessengerMiniApp = computed(() => {
    messengerScriptsLoadedTrigger.value
    if (!isClient) return false
    if (isTelegram.value || isMaxMiniApp.value) return true
    // Синхронная проверка по URL, чтобы избежать моргания UI до загрузки скриптов
    return !!readInitDataFromUrl()
  })

  const webApp = computed(() => {
    messengerScriptsLoadedTrigger.value
    if (!isClient) return null
    // @ts-ignore: Telegram WebApp может быть не объявлен
    return window.Telegram?.WebApp ?? null
  })

  /** Активный WebApp: Telegram или MAX — для initData и кросс-мессенджерного storage. */
  const messengerWebApp = computed(() => {
    messengerScriptsLoadedTrigger.value
    if (!isClient) return null
    const tg = window.Telegram?.WebApp
    if (tg?.initData) return tg
    const max = window.WebApp
    if (max?.initData) return max
    return null
  })

  const messengerInitData = computed(() => {
    const fromBridge = messengerWebApp.value?.initData ?? ''
    if (fromBridge) return fromBridge
    return readInitDataFromUrl()
  })

  /** Заголовки для API: тот же initData, legacy-имя + явный алиас. */
  function buildMessengerAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra }
    const data = messengerInitData.value
    if (data) {
      headers['x-telegram-init-data'] = data
      headers['x-messenger-init-data'] = data
    }
    return headers
  }

  function messengerClientChannel(): MessengerClientChannel {
    if (isTelegram.value) return 'telegram_mini'
    if (isMaxMiniApp.value) return 'max_mini'
    return 'web'
  }

  function expandMessengerViewport() {
    const app = messengerWebApp.value as { expand?: () => void } | null
    if (!app || typeof app.expand !== 'function') return
    try {
      app.expand()
    } catch {
      // ignore bridge-specific expand errors
    }
  }

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
    return baseWeb
  }

  function buttonClass(baseWeb: string): string {
    return baseWeb
  }

  function textClass(baseWeb: string): string {
    return baseWeb
  }

  function mutedTextClass(baseWeb: string): string {
    return baseWeb
  }

  return {
    isTelegram,
    isMaxMiniApp,
    isMessengerMiniApp,
    webApp,
    messengerWebApp,
    messengerInitData,
    buildMessengerAuthHeaders,
    messengerClientChannel,
    expandMessengerViewport,
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

