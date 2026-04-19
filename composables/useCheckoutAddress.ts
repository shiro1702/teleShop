import { useRoute } from 'vue-router'
import { dadataSuggest, type DadataSuggestItem } from '~/utils/dadataApi'
import { useDeliveryZone } from '~/composables/useDeliveryZone'
import { useTelegram } from '~/composables/useTelegram'
import { useMessengerStorage } from '~/composables/useMessengerStorage'
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
  lat?: number | null
  lon?: number | null
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

export type UseCheckoutAddressOptions = {
  /** If set, called after Dadata coords are known; can run multi-branch delivery-resolve instead of local zone-only check */
  onGeocodedCoords?: (coords: { lat: number; lon: number }) => void | Promise<void>
  /** Returns current resolved coordinates so saveCurrentAddress can persist them */
  getCurrentCoords?: () => { lat: number; lon: number } | null
}

export type SaveAddressPayload = {
  addressLine: string
  flat?: string | null
  comment?: string | null
  lat?: number | null
  lon?: number | null
}

export function useCheckoutAddress(options?: UseCheckoutAddressOptions) {
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
  const selectedAddressId = ref<string>('')
  /** True after the first client-side load of saved addresses (API or local fallback). */
  const addressBookReady = ref(false)

  const { properties: deliveryZoneProps, reason, refresh: refreshZone, setZones } = useDeliveryZone()
  const onGeocodedCoords = options?.onGeocodedCoords
  const getCurrentCoords = options?.getCurrentCoords
  const {
    isMessengerMiniApp,
    messengerInitData,
    buildMessengerAuthHeaders,
  } = useTelegram()
  const { canUseMessengerStorage, setItem, getItem } = useMessengerStorage()
  const supabaseUser = useSupabaseUser()

  const addressScopeKey = computed(() => resolveCartScopeKey(route, tenantKey.value))
  const addressStorageKey = computed(() => buildAddressStorageKey(addressScopeKey.value))
  /** Как checkoutXShopId: UUID тенанта, иначе slug/query из маршрута — для стабильного ключа и x-shop-id. */
  const addressXShopId = computed(() => {
    const fromTenant = typeof tenant.value.shopId === 'string' ? tenant.value.shopId.trim() : ''
    if (fromTenant) return fromTenant
    const qShop = route.query.shop_id ?? route.query.shopId
    const fromQuery = typeof qShop === 'string'
      ? qShop.trim()
      : Array.isArray(qShop) && typeof qShop[0] === 'string'
        ? qShop[0].trim()
        : ''
    if (fromQuery) return fromQuery
    const slug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
    return slug
  })

  const addressBookContextKey = computed<string | null>(() => {
    if (!process.client) return null
    const storage = addressStorageKey.value
    const shop = addressXShopId.value
    if (supabaseUser.value?.id && shop) {
      return `api:${supabaseUser.value.id}\t${shop}\t${storage}`
    }
    if (isMessengerMiniApp.value && messengerInitData.value && shop) {
      return `api:messenger\t${shop}\t${storage}`
    }
    return `local:${storage}`
  })

  let lastAddressBookFetchedKey: string | null = null
  let addressBookInFlightKey: string | null = null
  let addressBookInFlightPromise: Promise<void> | null = null

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
    if (canUseMessengerStorage()) {
      await setItem(addressStorageKey.value, data)
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

  async function readGuestAddressesForMerge(): Promise<SavedAddressItem[]> {
    const fromLocal = readGuestAddressesFromLocalStorage()
    if (!canUseMessengerStorage()) {
      return fromLocal
    }
    const scopedCloud = parseSavedAddressesJson(await getItem(addressStorageKey.value))
    const fromCloud = scopedCloud.length > 0
      ? scopedCloud
      : parseSavedAddressesJson(await getItem(LEGACY_ADDRESS_STORAGE_KEY))
    return mergeAddressesDedupe(fromCloud, fromLocal)
  }

  function buildAuthHeaders() {
    const id = addressXShopId.value
    return buildMessengerAuthHeaders(id ? { 'x-shop-id': id } : undefined)
  }

  function canUseAddressApi() {
    return !!(addressXShopId.value && (supabaseUser.value || (isMessengerMiniApp.value && messengerInitData.value)))
  }

  function normalizeCoords(lat: unknown, lon: unknown) {
    const nextLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : null
    const nextLon = typeof lon === 'number' && Number.isFinite(lon) ? lon : null
    return { lat: nextLat, lon: nextLon }
  }

  function upsertAddressLocal(payload: SaveAddressPayload): SavedAddressItem {
    const addressLine = payload.addressLine.trim()
    const flatLine = (payload.flat || '').trim()
    const commentLine = (payload.comment || '').trim()
    const coords = normalizeCoords(payload.lat, payload.lon)
    const existingIdx = savedAddresses.value.findIndex((a) => addressDedupeKey(a) === addressDedupeKey({
      address: addressLine,
      flat: flatLine,
    }))

    const next: SavedAddressItem = {
      id: existingIdx >= 0 ? savedAddresses.value[existingIdx].id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      address: addressLine,
      flat: flatLine || undefined,
      comment: commentLine || undefined,
      lat: coords.lat,
      lon: coords.lon,
    }

    if (existingIdx >= 0) {
      savedAddresses.value.splice(existingIdx, 1)
    }
    savedAddresses.value.unshift(next)
    savedAddresses.value = savedAddresses.value.slice(0, 5)
    selectedAddressId.value = next.id
    return next
  }

  async function saveAddressToServer(payload: SaveAddressPayload): Promise<SavedAddressItem | null> {
    if (!canUseAddressApi()) return null
    try {
      await $fetch('/api/customer/addresses', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: {
          addressLine: payload.addressLine.trim(),
          flat: payload.flat?.trim() || null,
          comment: payload.comment?.trim() || null,
          lat: normalizeCoords(payload.lat, payload.lon).lat,
          lon: normalizeCoords(payload.lat, payload.lon).lon,
        },
      })
      await loadSavedAddresses({ force: true })
      const dedupe = addressDedupeKey({ address: payload.addressLine, flat: payload.flat })
      const matched = savedAddresses.value.find((a) => addressDedupeKey(a) === dedupe) ?? null
      if (matched?.id) selectedAddressId.value = matched.id
      return matched
    } catch {
      return null
    }
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
            lat: typeof g.lat === 'number' && Number.isFinite(g.lat) ? g.lat : null,
            lon: typeof g.lon === 'number' && Number.isFinite(g.lon) ? g.lon : null,
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
      if (onGeocodedCoords) {
        await onGeocodedCoords({ lat: item.lat, lon: item.lon })
      } else {
        refreshZone(item.lat, item.lon)
      }
    }
  }

  function applySavedAddress(addr: { id: string; address: string; flat?: string; comment?: string }) {
    addressLine.value = addr.address
    flat.value = addr.flat ?? ''
    comment.value = addr.comment ?? ''
    selectedAddressId.value = addr.id
  }

  /** If an address is selected but the line wasn’t filled (e.g. after API load), sync from saved list. */
  function syncSelectedToFormIfEmpty() {
    const sel = savedAddresses.value.find((a) => a.id === selectedAddressId.value)
    if (!sel?.address?.trim()) return
    if (!addressLine.value.trim()) {
      applySavedAddress(sel)
    }
  }

  async function loadSavedAddresses(options?: { force?: boolean }) {
    if (!process.client) return
    const key = addressBookContextKey.value
    if (!key) return

    if (!options?.force && key === lastAddressBookFetchedKey) return
    if (!options?.force && addressBookInFlightPromise && addressBookInFlightKey === key) {
      await addressBookInFlightPromise
      return
    }

    const loadKey = key

    const run = async () => {
      addressBookReady.value = false
      try {
        if (canUseAddressApi()) {
          try {
            const guestBefore = await readGuestAddressesForMerge()
            if (addressBookContextKey.value !== loadKey) return
            const res = await $fetch<{ ok: boolean; items?: SavedAddressItem[] }>('/api/customer/addresses', {
              headers: buildAuthHeaders(),
            })
            if (addressBookContextKey.value !== loadKey) return
            let apiItems = Array.isArray(res.items) ? res.items : []
            if (guestBefore.length > 0) {
              apiItems = await syncGuestAddressesToServer(guestBefore, apiItems)
              await pruneGuestStorageAfterApiSync(apiItems, guestBefore)
            }
            if (addressBookContextKey.value !== loadKey) return
            const guestAfter = await readGuestAddressesForMerge()
            if (addressBookContextKey.value !== loadKey) return
            savedAddresses.value = mergeAddressesDedupe(apiItems, guestAfter)
            if (!selectedAddressId.value && savedAddresses.value[0]?.id) {
              selectedAddressId.value = savedAddresses.value[0].id
            } else if (selectedAddressId.value && !savedAddresses.value.some((a) => a.id === selectedAddressId.value)) {
              selectedAddressId.value = savedAddresses.value[0]?.id || ''
            }
            syncSelectedToFormIfEmpty()
            lastAddressBookFetchedKey = loadKey
            return
          } catch {
            if (addressBookContextKey.value !== loadKey) return
            // fallback to local storage below
          }
        }

        if (canUseMessengerStorage()) {
          savedAddresses.value = await readGuestAddressesForMerge()
          if (addressBookContextKey.value !== loadKey) return
          if (!selectedAddressId.value && savedAddresses.value[0]?.id) selectedAddressId.value = savedAddresses.value[0].id
          syncSelectedToFormIfEmpty()
          lastAddressBookFetchedKey = loadKey
          return
        }

        savedAddresses.value = readGuestAddressesFromLocalStorage()
        if (!selectedAddressId.value && savedAddresses.value[0]?.id) selectedAddressId.value = savedAddresses.value[0].id
        syncSelectedToFormIfEmpty()
        lastAddressBookFetchedKey = loadKey
      } finally {
        addressBookReady.value = true
      }
    }

    const p = run()
    addressBookInFlightKey = loadKey
    addressBookInFlightPromise = p
    void p.finally(() => {
      if (addressBookInFlightKey === loadKey) {
        addressBookInFlightKey = null
        addressBookInFlightPromise = null
      }
    })
    await p
  }

  async function persistAddresses() {
    const data = JSON.stringify(savedAddresses.value)
    const key = addressStorageKey.value

    if (canUseMessengerStorage()) {
      await setItem(key, data)
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

    const currentCoords = getCurrentCoords ? getCurrentCoords() : null
    const payload: SaveAddressPayload = {
      addressLine: line,
      flat: flat.value.trim() || null,
      comment: comment.value.trim() || null,
      lat: currentCoords?.lat ?? null,
      lon: currentCoords?.lon ?? null,
    }

    upsertAddressLocal(payload)
    if (canUseAddressApi()) {
      const saved = await saveAddressToServer(payload)
      if (!saved) {
        await persistAddresses()
      }
    } else {
      await persistAddresses()
    }
  }

  async function saveAddress(payload: SaveAddressPayload) {
    if (!payload.addressLine?.trim()) return null
    const local = upsertAddressLocal(payload)
    if (canUseAddressApi()) {
      const server = await saveAddressToServer(payload)
      if (server) return server
    }
    await persistAddresses()
    return local
  }

  async function deleteSavedAddress(id: string) {
    savedAddresses.value = savedAddresses.value.filter((a) => a.id !== id)
    if (selectedAddressId.value === id) {
      selectedAddressId.value = savedAddresses.value[0]?.id || ''
    }
    if (addressXShopId.value && (supabaseUser.value || (isMessengerMiniApp.value && messengerInitData.value))) {
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

  watch(addressBookContextKey, (nextKey: string | null) => {
    if (!nextKey) {
      lastAddressBookFetchedKey = null
      addressBookInFlightKey = null
      addressBookInFlightPromise = null
      return
    }
    void loadSavedAddresses()
  }, { immediate: true })

  function setDeliveryZones(zones: DeliveryZoneFeature[]) {
    setZones(zones)
  }

  const selectedAddress = computed(() =>
    savedAddresses.value.find((a) => a.id === selectedAddressId.value) ?? null,
  )

  function selectSavedAddressById(id: string) {
    const found = savedAddresses.value.find((a) => a.id === id)
    if (!found) return null
    applySavedAddress(found)
    selectedAddressId.value = found.id
    return found
  }

  return {
    addressLine,
    flat,
    comment,
    addressInputRef,
    suggestItems,
    isSuggestLoading,
    savedAddresses,
    selectedAddressId,
    addressBookReady,
    selectedAddress,
    deliveryZoneProps,
    setDeliveryZones,
    refreshDeliveryZone: refreshZone,
    onAddressInput,
    selectSuggestion,
    applySavedAddress,
    selectSavedAddressById,
    saveCurrentAddress,
    saveAddress,
    deleteSavedAddress,
    loadSavedAddresses,
  }
}

