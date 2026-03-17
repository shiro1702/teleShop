import { dadataSuggest, type DadataSuggestItem } from '~/utils/dadataApi'
import { useDeliveryZone } from '~/composables/useDeliveryZone'
import { useTelegram } from '~/composables/useTelegram'

export type CheckoutAddressState = {
  addressLine: string
  flat: string
  comment: string
}

export function useCheckoutAddress() {
  const cartStore = useCartStore()
  const addressLine = ref('')
  const flat = ref('')
  const comment = ref('')
  const addressInputRef = ref<HTMLInputElement | null>(null)
  const suggestItems = ref<DadataSuggestItem[]>([])
  const isSuggestLoading = ref(false)
  const savedAddresses = ref<
    {
      id: string
      address: string
      flat?: string
      comment?: string
    }[]
  >([])

  const { properties: deliveryZoneProps, reason, refresh: refreshZone } = useDeliveryZone()
  const { isTelegram, webApp } = useTelegram()

  const STORAGE_KEY = 'teleshop_addresses'

  function onAddressInput() {
    const query = addressLine.value.trim()
    if (query.length > 0) {
      cartStore.setDeliveryError(null)
    }

    suggestItems.value = []
    if (query.length < 3) {
      isSuggestLoading.value = false
      return
    }

    const fn = onAddressInput as any
    if (fn._timer) {
      clearTimeout(fn._timer)
    }
    fn._timer = setTimeout(async () => {
      isSuggestLoading.value = true
      try {
        const currentQuery = addressLine.value.trim()
        if (currentQuery.length < 3) {
          suggestItems.value = []
          return
        }
        const items = await dadataSuggest(currentQuery)
        suggestItems.value = items
      } finally {
        isSuggestLoading.value = false
      }
    }, 400)
  }

  async function selectSuggestion(item: DadataSuggestItem) {
    addressLine.value = item.displayName
    suggestItems.value = []
    isSuggestLoading.value = false

    if (item.lat != null && item.lon != null) {
      refreshZone(item.lat, item.lon)
    }
  }

  function applySavedAddress(addr: { id: string; address: string; flat?: string; comment?: string }) {
    addressLine.value = addr.address
    flat.value = addr.flat ?? ''
    comment.value = addr.comment ?? ''
  }

  async function loadSavedAddresses() {
    if (isTelegram.value && webApp.value?.CloudStorage) {
      await new Promise<void>((resolve) => {
        webApp.value!.CloudStorage.getItem(STORAGE_KEY, (err: unknown, value: string | null) => {
          if (!err && value) {
            try {
              savedAddresses.value = JSON.parse(value) as (typeof savedAddresses.value)[number][]
            } catch {
              savedAddresses.value = []
            }
          }
          resolve()
        })
      })

      if (savedAddresses.value.length === 0 && process.client) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            savedAddresses.value = JSON.parse(raw) as (typeof savedAddresses.value)[number][]
          }
        } catch {
          savedAddresses.value = []
        }
      }
      return
    }

    if (process.client) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          savedAddresses.value = JSON.parse(raw) as (typeof savedAddresses.value)[number][]
        }
      } catch {
        savedAddresses.value = []
      }
    }
  }

  async function persistAddresses() {
    const data = JSON.stringify(savedAddresses.value)

    if (isTelegram.value && webApp.value?.CloudStorage) {
      await new Promise<void>((resolve) => {
        webApp.value!.CloudStorage.setItem(STORAGE_KEY, data, () => resolve())
      })
    } else if (process.client) {
      localStorage.setItem(STORAGE_KEY, data)
    }
  }

  async function saveCurrentAddress() {
    const line = addressLine.value.trim()
    if (!line) return

    const existing = savedAddresses.value.find(
      (a) => a.address === line && a.flat === flat.value.trim()
    )
    if (existing) return

    savedAddresses.value.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      address: line,
      flat: flat.value.trim() || undefined,
      comment: comment.value.trim() || undefined,
    })

    savedAddresses.value = savedAddresses.value.slice(0, 5)
    await persistAddresses()
  }

  async function deleteSavedAddress(id: string) {
    savedAddresses.value = savedAddresses.value.filter((a) => a.id !== id)
    await persistAddresses()
  }

  watch(
    deliveryZoneProps,
    (zone) => {
      cartStore.setDeliveryZone(zone ?? null)
    },
  )

  watch(reason, (val) => {
    if (val === 'out_of_zone') {
      cartStore.setDeliveryZone(null)
    }
  })

  onMounted(() => {
    loadSavedAddresses()
  })

  return {
    addressLine,
    flat,
    comment,
    addressInputRef,
    suggestItems,
    isSuggestLoading,
    savedAddresses,
    deliveryZoneProps,
    onAddressInput,
    selectSuggestion,
    applySavedAddress,
    saveCurrentAddress,
    deleteSavedAddress,
  }
}

