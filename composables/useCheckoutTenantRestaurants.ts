import { computed, ref, watch, type Ref } from 'vue'
import type { DeliveryZoneFeature } from '~/utils/deliveryZones'

export type FulfillmentType = 'delivery' | 'pickup' | 'qr-menu'

export type PickupPoint = {
  id: string
  name: string
  address: string
}

export type RestaurantItem = {
  id: string
  name: string
  address: string
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
  const selectedPickupPointId = ref<string>('')
  const selectedRestaurantId = ref<string>('')
  const restaurants = ref<RestaurantItem[]>([])
  const restaurantsLoaded = ref(false)
  const restaurantZones = ref<DeliveryZoneFeature[]>([])
  const organizationTimezone = ref<string>('Asia/Irkutsk')

  const selectedRestaurant = computed(() =>
    restaurants.value.find((r) => r.id === selectedRestaurantId.value) ?? null,
  )
  const selectedRestaurantWorkingHours = computed(() =>
    selectedRestaurant.value?.effective_working_hours ?? null,
  )

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
    if (selectedRestaurant.value) {
      const fromFlags: FulfillmentType[] = []
      if (selectedRestaurant.value.supports_delivery) fromFlags.push('delivery')
      if (selectedRestaurant.value.supports_pickup) fromFlags.push('pickup')
      if (selectedRestaurant.value.supports_qr_menu) fromFlags.push('qr-menu')
      // Важно: если у ресторана не включены delivery/pickup,
      // не делаем fallback на глобальную конфигурацию.
      return fromFlags
    }

    // Пока не загрузились рестораны (и, соответственно, не выбран ресторан),
    // не показываем delivery/pickup из fallback runtime-конфигурации,
    // иначе получится “неверный” UI до прихода данных.
    if (!restaurantsLoaded.value) return []

    // После загрузки ресторанов — всё равно нет выбранного ресторана,
    // поэтому delivery/pickup скрываем, чтобы не показывать неверные режимы.
    return []

    const parsed = params.fulfillmentTypesConfigRaw
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x): x is FulfillmentType => x === 'delivery' || x === 'pickup')

    if (parsed.length) {
      return Array.from(new Set(parsed))
    }

    return ['delivery', 'pickup']
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

      try {
        const headers = params.shopIdFromRoute.value ? { 'x-shop-id': params.shopIdFromRoute.value } : undefined
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

        const mapped: DeliveryZoneFeature[] = res.items
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

  async function loadRestaurants() {
    try {
      const headers = params.shopIdFromRoute.value ? { 'x-shop-id': params.shopIdFromRoute.value } : undefined
      const query = params.shopIdFromRoute.value ? { shop_id: params.shopIdFromRoute.value } : undefined
      const res = await $fetch<{ ok: boolean; items: RestaurantItem[]; organizationTimezone?: string }>('/api/restaurants', {
        headers,
        query,
      })
      if (res?.ok && Array.isArray(res.items)) {
        restaurants.value = res.items
        if (typeof res.organizationTimezone === 'string' && res.organizationTimezone.trim()) {
          organizationTimezone.value = res.organizationTimezone
        }
      }
    } catch {
      // keep fallback behavior for local/dev
    }
    finally {
      restaurantsLoaded.value = true
    }
  }

  return {
    selectedPickupPointId,
    selectedRestaurantId,
    selectedPickupPoint,
    restaurants,
    restaurantZones,
    pickupPoints,
    organizationTimezone,
    selectedRestaurantWorkingHours,
    availableFulfillmentTypes,
    hasDeliveryOption,
    hasPickupOption,
    hasQrMenuOption,
    pickupIntroText,
    loadRestaurants,
  }
}
