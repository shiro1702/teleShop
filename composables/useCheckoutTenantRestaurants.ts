import { computed, ref, watch, type Ref } from 'vue'
import type { DeliveryZoneFeature } from '~/utils/deliveryZones'
import { useTelegram } from '~/composables/useTelegram'

export type FulfillmentType = 'delivery' | 'pickup' | 'qr-menu'
export type DineInHallMode = 'qr-menu-browse' | 'to-table' | 'pickup-point'

export type PickupPoint = {
  id: string
  name: string
  address: string
}

export type RestaurantItem = {
  id: string
  name: string
  address: string
  lat?: number | null
  lon?: number | null
  supports_delivery: boolean
  supports_pickup: boolean
  supports_qr_menu: boolean
  effective_working_hours?: Record<string, any>
}

type RestaurantZoneApiItem = {
  id: string
  name: string
  polygon_geojson: {
    type?: 'Feature' | 'Polygon'
    geometry?: { type: 'Polygon'; coordinates: number[][][] }
    coordinates?: number[][][]
  }
  min_order_amount: number
  delivery_cost: number
  free_delivery_threshold: number
  priority?: number | null
}

function mapRestaurantZonesFromApiItems(items: RestaurantZoneApiItem[]): DeliveryZoneFeature[] {
  return items
    .map((zone): DeliveryZoneFeature | null => {
      const raw = zone.polygon_geojson
      const geometry = raw?.type === 'Feature'
        ? raw.geometry
        : raw?.type === 'Polygon'
          ? { type: 'Polygon' as const, coordinates: raw.coordinates ?? [] }
          : raw?.geometry
      if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return null

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: geometry.coordinates,
        },
        properties: {
          slug: zone.id,
          name: zone.name,
          minOrderAmount: zone.min_order_amount,
          deliveryCost: zone.delivery_cost,
          freeDeliveryThreshold: zone.free_delivery_threshold,
          priority: typeof zone.priority === 'number' && Number.isFinite(zone.priority) ? zone.priority : 0,
        },
      }
    })
    .filter((z): z is DeliveryZoneFeature => z !== null)
}

type UseCheckoutTenantRestaurantsParams = {
  shopIdFromRoute: Ref<string | null>
  pickupPointsConfigRaw: string
  fulfillmentTypesConfigRaw: string
  currentFulfillmentType: Ref<FulfillmentType>
  setDeliveryZones: (zones: DeliveryZoneFeature[]) => void
  /** When true, next zone reload after branch change will not clear delivery zone / error (server resolve will refresh) */
  skipNextDeliveryZoneReset?: Ref<boolean>
}

export function useCheckoutTenantRestaurants(params: UseCheckoutTenantRestaurantsParams) {
  const cartStore = useCartStore()
  const { buildMessengerAuthHeaders, messengerInitData } = useTelegram()
  const selectedPickupPointId = ref<string>('')
  function buildTenantHeaders(shopId: string | null): Record<string, string> | undefined {
    const base: Record<string, string> = shopId ? { 'x-shop-id': shopId } : {}
    const headers = buildMessengerAuthHeaders(base)
    return Object.keys(headers).length ? headers : undefined
  }

  const selectedRestaurantId = ref<string>('')
  const restaurants = ref<RestaurantItem[]>([])
  const restaurantsLoaded = ref(false)
  const restaurantZones = ref<DeliveryZoneFeature[]>([])
  const allRestaurantZones = ref<Record<string, DeliveryZoneFeature[]>>({})
  const organizationTimezone = ref<string>('Asia/Irkutsk')
  const dineInHallMode = ref<DineInHallMode>('to-table')

  let lastRestaurantsLoadedKey: string | null = null
  let restaurantsLoadInFlightKey: string | null = null
  let restaurantsLoadInFlightPromise: Promise<void> | null = null

  function getRestaurantsLoadKey(): string {
    const shop = typeof params.shopIdFromRoute.value === 'string' ? params.shopIdFromRoute.value.trim() : ''
    const init = messengerInitData.value ? '1' : '0'
    return `${shop}\t${init}`
  }

  function applyRestaurantZonesUi(mapped: DeliveryZoneFeature[]) {
    restaurantZones.value = mapped
    params.setDeliveryZones(mapped)
    if (params.skipNextDeliveryZoneReset?.value) {
      params.skipNextDeliveryZoneReset.value = false
    } else {
      cartStore.setDeliveryZone(null)
      if (params.currentFulfillmentType.value === 'delivery') {
        cartStore.setDeliveryError('Укажите адрес доставки, чтобы рассчитать доставку')
      }
    }
  }

  const selectedRestaurant = computed(() =>
    restaurants.value.find((r) => r.id === selectedRestaurantId.value) ?? null,
  )
  const selectedRestaurantWorkingHours = computed(() =>
    selectedRestaurant.value?.effective_working_hours ?? null,
  )

  function getRestaurantFulfillmentTypes(restaurant: RestaurantItem | null | undefined): FulfillmentType[] {
    if (!restaurant) return []
    const fromFlags: FulfillmentType[] = []
    if (restaurant.supports_delivery) fromFlags.push('delivery')
    if (restaurant.supports_pickup) fromFlags.push('pickup')
    if (restaurant.supports_qr_menu) fromFlags.push('qr-menu')
    return fromFlags
  }

  const pickupPoints = computed<PickupPoint[]>(() => {
    if (selectedRestaurant.value) {
      return [{
        id: selectedRestaurant.value.id,
        name: selectedRestaurant.value.name,
        address: selectedRestaurant.value.address,
      }]
    }

    try {
      const parsed = JSON.parse(params.pickupPointsConfigRaw) as unknown
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .filter((x): x is { id?: unknown; name?: unknown; address?: unknown } => !!x && typeof x === 'object')
          .map((x, idx) => {
            const id = typeof x.id === 'string' && x.id.trim() ? x.id.trim() : `pickup-${idx + 1}`
            const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : `Ресторан ${idx + 1}`
            const address = typeof x.address === 'string' ? x.address.trim() : ''
            return { id, name, address }
          })
          .filter((x) => x.address.length > 0)
        if (normalized.length) return normalized
      }
    } catch {
      // ignore invalid JSON config and use fallback
    }

    return [{
      id: 'main',
      name: 'Ресторан',
      address: 'Адрес ресторана не указан',
    }]
  })

  const selectedPickupPoint = computed<PickupPoint | null>(() =>
    pickupPoints.value.find((point) => point.id === selectedPickupPointId.value) ?? null,
  )

  const availableFulfillmentTypes = computed<FulfillmentType[]>(() => {
    // До загрузки филиалов не показываем способы получения, чтобы не мигал неверный UI.
    if (!restaurantsLoaded.value) return []

    const aggregated = new Set<FulfillmentType>()
    for (const restaurant of restaurants.value) {
      for (const type of getRestaurantFulfillmentTypes(restaurant)) {
        aggregated.add(type)
      }
    }
    return Array.from(aggregated)
  })

  const hasDeliveryOption = computed(() =>
    availableFulfillmentTypes.value.includes('delivery'),
  )

  const hasPickupOption = computed(() =>
    availableFulfillmentTypes.value.includes('pickup'),
  )

  const hasQrMenuOption = computed(() =>
    availableFulfillmentTypes.value.includes('qr-menu'),
  )

  const pickupIntroText = computed(() =>
    pickupPoints.value.length > 1
      ? 'Для самовывоза выберите ресторан. Мы отправим подтверждение и детали в Telegram после оформления заказа.'
      : 'Самовывоз доступен из одного ресторана. Мы отправим подтверждение и детали в Telegram после оформления заказа.',
  )

  watch(
    restaurants,
    (items) => {
      if (!items.length) return
      if (items.some((r) => r.id === selectedRestaurantId.value)) return
      selectedRestaurantId.value = items[0].id
    },
    { immediate: true },
  )

  watch(
    selectedRestaurantId,
    async (restaurantId) => {
      if (!restaurantId) {
        restaurantZones.value = []
        params.setDeliveryZones([])
        cartStore.setDeliveryZone(null)
        return
      }

      // Зоны доставки нужны только для delivery.
      // Дополнительно убеждаемся, что delivery вообще доступен для выбранного ресторана,
      // иначе может получиться лишний запрос до того, как currentFulfillmentType успеет обновиться.
      if (
        params.currentFulfillmentType.value !== 'delivery'
        || !availableFulfillmentTypes.value.includes('delivery')
      ) {
        restaurantZones.value = []
        params.setDeliveryZones([])
        cartStore.setDeliveryZone(null)
        return
      }

      const batch = allRestaurantZones.value
      if (restaurantId in batch) {
        applyRestaurantZonesUi(batch[restaurantId] ?? [])
        return
      }

      try {
        const headers = buildTenantHeaders(params.shopIdFromRoute.value)
        const query: Record<string, string> = { restaurant_id: restaurantId }
        if (params.shopIdFromRoute.value) query.shop_id = params.shopIdFromRoute.value
        const res = await $fetch<{ ok: boolean; items: RestaurantZoneApiItem[] }>('/api/restaurant-zones', {
          headers,
          query,
        })
        if (!res?.ok || !Array.isArray(res.items)) {
          restaurantZones.value = []
          params.setDeliveryZones([])
          cartStore.setDeliveryZone(null)
          return
        }

        const mapped = mapRestaurantZonesFromApiItems(res.items)
        applyRestaurantZonesUi(mapped)
      } catch {
        if (params.skipNextDeliveryZoneReset?.value) {
          params.skipNextDeliveryZoneReset.value = false
        }
        restaurantZones.value = []
        params.setDeliveryZones([])
        cartStore.setDeliveryZone(null)
      }
    },
    { immediate: true },
  )

  watch(
    pickupPoints,
    (points) => {
      const hasCurrent = points.some((point) => point.id === selectedPickupPointId.value)
      if (hasCurrent) return
      selectedPickupPointId.value = points.length === 1 ? points[0].id : ''
    },
    { immediate: true },
  )

  watch(
    availableFulfillmentTypes,
    (types) => {
      if (!types.length) return
      if (types.includes(params.currentFulfillmentType.value)) return
      params.currentFulfillmentType.value = types[0]
    },
    { immediate: true },
  )

  watch(
    [() => params.currentFulfillmentType.value, restaurants],
    ([type, items]) => {
      if (!items.length) return
      const current = items.find((restaurant) => restaurant.id === selectedRestaurantId.value) ?? null
      if (getRestaurantFulfillmentTypes(current).includes(type)) return
      const firstMatching = items.find((restaurant) => getRestaurantFulfillmentTypes(restaurant).includes(type)) ?? null
      if (firstMatching) {
        selectedRestaurantId.value = firstMatching.id
      }
    },
    { immediate: true, deep: true },
  )

  async function loadRestaurants(options?: { force?: boolean }) {
    const loadKey = getRestaurantsLoadKey()

    if (
      !options?.force
      && loadKey === lastRestaurantsLoadedKey
      && restaurantsLoaded.value
    ) {
      return
    }

    if (!options?.force && restaurantsLoadInFlightPromise && restaurantsLoadInFlightKey === loadKey) {
      await restaurantsLoadInFlightPromise
      return
    }

    const run = async () => {
      try {
        const headers = buildTenantHeaders(params.shopIdFromRoute.value)
        const query = params.shopIdFromRoute.value ? { shop_id: params.shopIdFromRoute.value } : undefined
        const res = await $fetch<{
          ok: boolean
          items: RestaurantItem[]
          organizationTimezone?: string
          dineInHallMode?: DineInHallMode
        }>('/api/restaurants', {
          headers,
          query,
        })
        if (res?.ok && Array.isArray(res.items)) {
          await loadAllRestaurantZones(res.items)
          restaurants.value = res.items
          lastRestaurantsLoadedKey = loadKey
          if (typeof res.organizationTimezone === 'string' && res.organizationTimezone.trim()) {
            organizationTimezone.value = res.organizationTimezone
          }
          if (
            res.dineInHallMode === 'qr-menu-browse'
            || res.dineInHallMode === 'to-table'
            || res.dineInHallMode === 'pickup-point'
          ) {
            dineInHallMode.value = res.dineInHallMode
          }
        }
      } catch {
        // keep fallback behavior for local/dev
      } finally {
        restaurantsLoaded.value = true
      }
    }

    const p = run()
    restaurantsLoadInFlightKey = loadKey
    restaurantsLoadInFlightPromise = p
    void p.finally(() => {
      if (restaurantsLoadInFlightKey === loadKey) {
        restaurantsLoadInFlightKey = null
        restaurantsLoadInFlightPromise = null
      }
    })
    await p
  }

  async function loadAllRestaurantZones(items: RestaurantItem[]) {
    const headers = buildTenantHeaders(params.shopIdFromRoute.value)
    const result: Record<string, DeliveryZoneFeature[]> = {}
    await Promise.all(items.map(async (restaurant) => {
      if (!restaurant.supports_delivery) {
        result[restaurant.id] = []
        return
      }
      try {
        const query: Record<string, string> = { restaurant_id: restaurant.id }
        if (params.shopIdFromRoute.value) query.shop_id = params.shopIdFromRoute.value
        const res = await $fetch<{ ok: boolean; items: RestaurantZoneApiItem[] }>('/api/restaurant-zones', {
          headers,
          query,
        })
        result[restaurant.id] = Array.isArray(res?.items)
          ? mapRestaurantZonesFromApiItems(res.items)
          : []
      } catch {
        result[restaurant.id] = []
      }
    }))
    allRestaurantZones.value = result
  }

  return {
    selectedPickupPointId,
    selectedRestaurantId,
    selectedPickupPoint,
    restaurants,
    restaurantsLoaded,
    restaurantZones,
    allRestaurantZones,
    pickupPoints,
    organizationTimezone,
    dineInHallMode,
    selectedRestaurantWorkingHours,
    availableFulfillmentTypes,
    hasDeliveryOption,
    hasPickupOption,
    hasQrMenuOption,
    pickupIntroText,
    getRestaurantFulfillmentTypes,
    loadRestaurants,
  }
}
