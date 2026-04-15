import { computed, ref } from 'vue'
import type { DeliveryZoneFeature, DeliveryZoneProperties } from '~/utils/deliveryZones'
import { getDeliveryZones } from '~/utils/deliveryZones'
import { pointInPolygon } from '~/utils/geoPolygon'

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

  function compareZoneProps(a: DeliveryZoneProperties, b: DeliveryZoneProperties): number {
    if (a.deliveryCost !== b.deliveryCost) return a.deliveryCost - b.deliveryCost
    const pa = a.priority ?? 0
    const pb = b.priority ?? 0
    if (pb !== pa) return pb - pa
    return a.slug.localeCompare(b.slug)
  }

  function refresh(lat: number, lon: number) {
    const zones = zonesRef.value
    zone.value = null
    reason.value = null

    const hits: DeliveryZoneFeature[] = []
    for (const z of zones) {
      if (pointInPolygon([lon, lat], z.geometry.coordinates)) {
        hits.push(z)
      }
    }

    if (!hits.length) {
      reason.value = 'out_of_zone'
      return
    }

    hits.sort((x, y) => compareZoneProps(x.properties, y.properties))
    zone.value = hits[0] ?? null
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

