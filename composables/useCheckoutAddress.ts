import { useRoute } from 'vue-router'
import { dadataSuggest, type DadataSuggestItem } from '~/utils/dadataApi'
import { useDeliveryZone } from '~/composables/useDeliveryZone'
import { useTelegram } from '~/composables/useTelegram'
import { useTenant } from '~/composables/useTenant'
import type { DeliveryZoneFeature } from '~/utils/deliveryZones'
import { resolveCartScopeKey } from '~/utils/cartScope'

const ADDRESS_STORAGE_PREFIX = 'teleshop_addresses'
const LEGACY_ADDRESS_STORAGE_KEY = 'teleshop_addresses'

export type SavedAddressItem = {
  id: string
  address: string
  flat?: string
  comment?: string
}

function buildAddressStorageKey(scopeKey: string | null): string {
  const scope = typeof scopeKey === 'string' ? scopeKey.trim() : ''
  return scope ? `${ADDRESS_STORAGE_PREFIX}:${scope}` : ADDRESS_STORAGE_PREFIX
}

function addressDedupeKey(a: { address: string; flat?: string | null | undefined }): string {
  const flat = typeof a.flat === 'string' ? a.flat : ''
  return `${(a.address || '').trim().toLowerCase()}|${flat.trim().toLowerCase()}`
}

function parseSavedAddressesJson(raw: string | null): SavedAddressItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is SavedAddressItem =>
        x
        && typeof x === 'object'
        && typeof (x as SavedAddressItem).id === 'string'
        && typeof (x as SavedAddressItem).address === 'string',
    )
  } catch {
    return []
  }
}

export type CheckoutAddressState = {
  addressLine: string
  flat: string
  comment: string
}

export function useCheckoutAddress() {
  const cartStore = useCartStore()
  const route = useRoute()
  const { tenant, tenantKey } = useTenant()
  const addressLine = ref('')
  const flat = ref('')
  const comment = ref('')
  const addressInputRef = ref<HTMLInputElement | null>(null)
  const suggestItems = ref<DadataSuggestItem[]>([])
  const isSuggestLoading = ref(false)
  const savedAddresses = ref<SavedAddressItem[]>([])

  const { properties: deliveryZoneProps, reason, refresh: refreshZone, setZones } = useDeliveryZone()
  const { isTelegram, webApp } = useTelegram()
  const supabaseUser = useSupabaseUser()

  const addressScopeKey = computed(() => resolveCartScopeKey(route, tenantKey.value))
  const addressStorageKey = computed(() => buildAddressStorageKey(addressScopeKey.value))
  const shopId = computed(() => {
    const raw = tenant.value.shopId
    return typeof raw === 'string' ? raw.trim() : ''
  })

  function readGuestAddressesFromLocalStorage(): SavedAddressItem[] {
    if (!process.client) return []
    const scoped = parseSavedAddressesJson(localStorage.getItem(addressStorageKey.value))
    if (scoped.length > 0) return scoped
    return parseSavedAddressesJson(localStorage.getItem(LEGACY_ADDRESS_STORAGE_KEY))
  }

  async function pruneGuestStorageAfterApiSync(apiItems: SavedAddressItem[], guestBefore: SavedAddressItem[]) {
    if (!process.client || guestBefore.length === 0) return
    const apiKeys = new Set(apiItems.map((a) => addressDedupeKey(a)))
    const remaining = guestBefore.filter((g) => !apiKeys.has(addressDedupeKey(g)))
    const data = JSON.stringify(remaining)
    try {
      if (remaining.length === 0) {
        localStorage.removeItem(addressStorageKey.value)
        localStorage.removeItem(LEGACY_ADDRESS_STORAGE_KEY)
      } else {
        localStorage.setItem(addressStorageKey.value, data)
        if (remaining.length < guestBefore.length) {
          localStorage.removeItem(LEGACY_ADDRESS_STORAGE_KEY)
        }
      }
    } catch {
      // ignore
    }
    if (isTelegram.value && (webApp.value as any)?.CloudStorage) {
      await new Promise<void>((resolve) => {
        (webApp.value as any).CloudStorage.setItem(addressStorageKey.value, data, () => resolve())
      })
    }
  }

  function mergeAddressesDedupe(serverFirst: SavedAddressItem[], extra: SavedAddressItem[]): SavedAddressItem[] {
    const seen = new Set<string>()
    const out: SavedAddressItem[] = []
    for (const a of serverFirst) {
      const k = addressDedupeKey(a)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(a)
    }
    for (const a of extra) {
      const k = addressDedupeKey(a)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(a)
    }
    return out.slice(0, 5)
  }

  function telegramCloudGet(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      const wa = webApp.value as any
      if (!wa?.CloudStorage) {
        resolve(null)
        return
      }
      wa.CloudStorage.getItem(key, (_err: unknown, value: string | null) => {
        resolve(value ?? null)
      })
    })
  }

  async function readGuestAddressesForMerge(): Promise<SavedAddressItem[]> {
    const fromLocal = readGuestAddressesFromLocalStorage()
    if (!isTelegram.value || !(webApp.value as any)?.CloudStorage) {
      return fromLocal
    }
    const scopedCloud = parseSavedAddressesJson(await telegramCloudGet(addressStorageKey.value))
    const fromCloud = scopedCloud.length > 0
      ? scopedCloud
      : parseSavedAddressesJson(await telegramCloudGet(LEGACY_ADDRESS_STORAGE_KEY))
    return mergeAddressesDedupe(fromCloud, fromLocal)
  }

  function buildAuthHeaders() {
    const headers: Record<string, string> = {}
    if (shopId.value) {
      headers['x-shop-id'] = shopId.value
    }
    if (isTelegram.value && webApp.value?.initData) {
      headers['x-telegram-init-data'] = webApp.value.initData
    }
    return headers
  }

  async function syncGuestAddressesToServer(guest: SavedAddressItem[], apiItems: SavedAddressItem[]) {
    const apiKeys = new Set(apiItems.map((a) => addressDedupeKey(a)))
    const toSync = guest.filter((g) => !apiKeys.has(addressDedupeKey(g)))
    for (const g of toSync) {
      try {
        await $fetch('/api/customer/addresses', {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: {
            addressLine: g.address,
            flat: g.flat?.trim() || null,
            comment: g.comment?.trim() || null,
          },
        })
      } catch {
        // single address — пропускаем, останется в guest merge
      }
    }
    if (toSync.length === 0) return apiItems
    try {
      const res = await $fetch<{ ok: boolean; items?: SavedAddressItem[] }>('/api/customer/addresses', {
        headers: buildAuthHeaders(),
      })
      return Array.isArray(res.items) ? res.items : apiItems
    } catch {
      return apiItems
    }
  }

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
    if (shopId.value && (supabaseUser.value || (isTelegram.value && webApp.value?.initData))) {
      try {
        const guestBefore = await readGuestAddressesForMerge()
        const res = await $fetch<{ ok: boolean; items?: SavedAddressItem[] }>('/api/customer/addresses', {
          headers: buildAuthHeaders(),
        })
        let apiItems = Array.isArray(res.items) ? res.items : []
        if (guestBefore.length > 0) {
          apiItems = await syncGuestAddressesToServer(guestBefore, apiItems)
          await pruneGuestStorageAfterApiSync(apiItems, guestBefore)
        }
        const guestAfter = await readGuestAddressesForMerge()
        savedAddresses.value = mergeAddressesDedupe(apiItems, guestAfter)
        return
      } catch {
        // fallback to local storage below
      }
    }

    if (isTelegram.value && (webApp.value as any)?.CloudStorage) {
      savedAddresses.value = await readGuestAddressesForMerge()
      return
    }

    if (process.client) {
      savedAddresses.value = readGuestAddressesFromLocalStorage()
    }
  }

  async function persistAddresses() {
    const data = JSON.stringify(savedAddresses.value)
    const key = addressStorageKey.value

    if (isTelegram.value && (webApp.value as any)?.CloudStorage) {
      await new Promise<void>((resolve) => {
        (webApp.value as any).CloudStorage.setItem(key, data, () => resolve())
      })
    }
    if (process.client) {
      try {
        localStorage.setItem(key, data)
      } catch {
        // ignore
      }
    }
  }

  async function saveCurrentAddress() {
    const line = addressLine.value.trim()
    if (!line) return

    const existing = savedAddresses.value.find((a) => a.address === line && (a.flat || '') === flat.value.trim())
    if (existing) return

    const nextAddress = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      address: line,
      flat: flat.value.trim() || undefined,
      comment: comment.value.trim() || undefined,
    }
    savedAddresses.value.unshift(nextAddress)

    savedAddresses.value = savedAddresses.value.slice(0, 5)
    if (shopId.value && (supabaseUser.value || (isTelegram.value && webApp.value?.initData))) {
      try {
        await $fetch('/api/customer/addresses', {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: {
            addressLine: line,
            flat: flat.value.trim() || null,
            comment: comment.value.trim() || null,
          },
        })
        await loadSavedAddresses()
      } catch {
        await persistAddresses()
      }
    } else {
      await persistAddresses()
    }
  }

  async function deleteSavedAddress(id: string) {
    savedAddresses.value = savedAddresses.value.filter((a) => a.id !== id)
    if (shopId.value && (supabaseUser.value || (isTelegram.value && webApp.value?.initData))) {
      try {
        await $fetch(`/api/customer/addresses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: buildAuthHeaders(),
        })
      } catch {
        await persistAddresses()
      }
    } else {
      await persistAddresses()
    }
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

  watch(
    () => [
      supabaseUser.value?.id ?? null,
      shopId.value,
      addressStorageKey.value,
      isTelegram.value ? (webApp.value?.initData ? 't' : '') : '',
    ],
    () => {
      if (!process.client) return
      void loadSavedAddresses()
    },
    { immediate: true },
  )

  function setDeliveryZones(zones: DeliveryZoneFeature[]) {
    setZones(zones)
  }

  return {
    addressLine,
    flat,
    comment,
    addressInputRef,
    suggestItems,
    isSuggestLoading,
    savedAddresses,
    deliveryZoneProps,
    setDeliveryZones,
    onAddressInput,
    selectSuggestion,
    applySavedAddress,
    saveCurrentAddress,
    deleteSavedAddress,
  }
}

