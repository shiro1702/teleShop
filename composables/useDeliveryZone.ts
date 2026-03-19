import { computed, ref } from 'vue'
import type { DeliveryZoneFeature, DeliveryZoneProperties } from '~/utils/deliveryZones'
import { getDeliveryZones } from '~/utils/deliveryZones'

export interface UseDeliveryZoneResult {
  zone: Ref<DeliveryZoneFeature | null>
  isInZone: ComputedRef<boolean>
  properties: ComputedRef<DeliveryZoneProperties | null>
  reason: Ref<'out_of_zone' | null>
  refresh: (lat: number, lon: number) => void
  setZones: (zones: DeliveryZoneFeature[]) => void
}

export function useDeliveryZone(initialLat?: number, initialLon?: number): UseDeliveryZoneResult {
  const zone = ref<DeliveryZoneFeature | null>(null)
  const reason = ref<'out_of_zone' | null>(null)
  const zonesRef = ref<DeliveryZoneFeature[]>(getDeliveryZones())

  const properties = computed(() => zone.value?.properties ?? null)
  const isInZone = computed(() => !!zone.value)

  function refresh(lat: number, lon: number) {
    const zones = zonesRef.value
    zone.value = null
    reason.value = null

    for (const z of zones) {
      if (pointInPolygon([lon, lat], z.geometry.coordinates)) {
        zone.value = z
        return
      }
    }

    reason.value = 'out_of_zone'
  }

  function setZones(zones: DeliveryZoneFeature[]) {
    zonesRef.value = Array.isArray(zones) ? zones : []
    zone.value = null
    reason.value = null
  }

  if (typeof initialLat === 'number' && typeof initialLon === 'number') {
    refresh(initialLat, initialLon)
  }

  return {
    zone,
    isInZone,
    properties,
    reason,
    refresh,
    setZones,
  }
}

// Простейшая проверка «точка в полигоне» (Ray casting algorithm)
// Координаты: [lon, lat]
function pointInPolygon(point: [number, number], polygons: number[][][]): boolean {
  const [x, y] = point
  // Берём только первый внешний контур
  const polygon = polygons[0]
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi

    if (intersect) inside = !inside
  }

  return inside
}

