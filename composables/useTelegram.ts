import { computed, onMounted, ref } from 'vue'

const BRIDGE_CONTINUATION_KEY = 'teleshop_order_continuation'
const MESSENGER_INIT_DATA_CACHE_KEY = 'teleshop_messenger_init_data'

export type MessengerClientChannel = 'web' | 'telegram_mini' | 'max_mini'
export type OrderContinuationHint = 'web_to_telegram' | 'web_to_max' | null

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

  function readCachedInitData(): string {
    if (!isClient) return ''
    try {
      const raw = sessionStorage.getItem(MESSENGER_INIT_DATA_CACHE_KEY) || ''
      return raw.trim()
    } catch {
      return ''
    }
  }

  function cacheInitData(value: string) {
    if (!isClient) return
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      sessionStorage.setItem(MESSENGER_INIT_DATA_CACHE_KEY, trimmed)
    } catch {
      // ignore storage errors
    }
  }

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

  /** Mini App открыт в Telegram (initData на iOS может появиться с задержкой после ready). */
  const isTelegram = computed(() => {
    if (!isClient) return false
    // @ts-ignore: Telegram WebApp может быть не объявлен
    return typeof window.Telegram?.WebApp !== 'undefined'
  })

  /** MAX мини-приложение: глобальный window.WebApp (не Telegram.WebApp). initData может быть только в hash/sessionStorage. */
  const isMaxMiniApp = computed(() => {
    if (!isClient) return false
    if (window.Telegram?.WebApp?.initData) return false
    if (typeof window.WebApp === 'undefined') return false
    const init = window.WebApp?.initData || readCachedInitData() || readInitDataFromUrl()
    return !!init
  })

  const isMessengerMiniApp = computed(() => isTelegram.value || isMaxMiniApp.value)

  const webApp = computed(() => {
    if (!isClient) return null
    // @ts-ignore: Telegram WebApp может быть не объявлен
    return window.Telegram?.WebApp ?? null
  })

  /** Активный WebApp: Telegram или MAX — для initData и кросс-мессенджерного storage. */
  const messengerWebApp = computed(() => {
    if (!isClient) return null
    const tg = window.Telegram?.WebApp
    if (tg?.initData) return tg
    const max = window.WebApp
    if (max?.initData) return max
    return null
  })

  const messengerInitDataTick = ref(0)

  function readMessengerInitDataNow(): string {
    const tg = isClient ? window.Telegram?.WebApp : undefined
    const fromBridge = tg?.initData?.trim() || messengerWebApp.value?.initData?.trim() || ''
    if (fromBridge) {
      cacheInitData(fromBridge)
      return fromBridge
    }
    const fromUrl = readInitDataFromUrl()
    if (fromUrl) {
      cacheInitData(fromUrl)
      return fromUrl
    }
    return readCachedInitData()
  }

  const messengerInitData = computed(() => {
    void messengerInitDataTick.value
    return readMessengerInitDataNow()
  })

  const initDataPollBootstrapped = useState('messenger-initdata-poll-bootstrapped', () => false)
  if (isClient) {
    onMounted(() => {
      if (initDataPollBootstrapped.value) return
      initDataPollBootstrapped.value = true

      const tg = window.Telegram?.WebApp
      try {
        tg?.ready?.()
      } catch {
        // ignore
      }
      let lastInitData = ''
      const poll = () => {
        const next = readMessengerInitDataNow()
        if (next && next !== lastInitData) {
          lastInitData = next
          messengerInitDataTick.value += 1
        }
      }
      poll()
      for (const delay of [50, 120, 250, 500, 1000, 2000]) {
        window.setTimeout(poll, delay)
      }
    })
  }

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

