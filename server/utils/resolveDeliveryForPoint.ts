import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'
import type { TenantRestaurant } from '~/server/utils/tenant'
import {
  extractPolygonCoordinatesFromGeoJson,
  pointInPolygon,
} from '~/utils/geoPolygon'
import {
  isOpenNowBySchedule,
  normalizeWeeklyWorkingHours,
  resolveEffectiveWorkingHours,
} from '~/utils/workingHours'

export type ResolvedDeliveryChoice = {
  restaurantId: string
  restaurantName: string
  zoneId: string
  zoneName: string
  minOrderAmount: number
  deliveryCost: number
  freeDeliveryThreshold: number
  priority: number
}

export type ResolveDeliveryForPointResult = {
  selected: ResolvedDeliveryChoice | null
  reason: 'ok' | 'out_of_zone' | 'all_closed' | 'delivery_disabled' | 'no_restaurants'
  /** True when a more expensive / lower-priority open branch was chosen because cheaper matches were closed */
  switchedDueToClosed: boolean
  /** The cheapest matching candidate (may be closed) — for UI messaging */
  cheapestMatch: ResolvedDeliveryChoice | null
  /** All matches after polygon hit, before open filter (for debugging / UI) */
  matchCount: number
}

type ZoneRow = {
  id: string
  restaurant_id: string
  name: string
  polygon_geojson: unknown
  min_order_amount: number
  delivery_cost: number
  free_delivery_threshold: number
  is_active: boolean
  priority?: number | null
}

function sortKey(a: {
  delivery_cost: number
  priority: number
  restaurantName: string
  zoneId: string
}) {
  return [
    a.delivery_cost,
    -a.priority,
    a.restaurantName,
    a.zoneId,
  ] as const
}

function compareCandidates(
  a: ReturnType<typeof sortKey>,
  b: ReturnType<typeof sortKey>,
): number {
  for (let i = 0; i < a.length; i++) {
    const av = a[i]
    const bv = b[i]
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return 0
}

/**
 * Resolves which branch + zone should serve a delivery point.
 * - All polygon matches collected, sorted by delivery_cost ASC, priority DESC, name, zone id.
 * - First **open** candidate in that order wins (cheapest open branch).
 */
export async function resolveDeliveryForPoint(
  event: H3Event,
  shopId: string,
  lat: number,
  lon: number,
): Promise<ResolveDeliveryForPointResult> {
  const point: [number, number] = [lon, lat]

  const org = await getOrganizationSettings(event, shopId)
  const allowed = new Set(org.ops.fulfillmentTypes)
  if (!allowed.has('delivery')) {
    return {
      selected: null,
      reason: 'delivery_disabled',
      switchedDueToClosed: false,
      cheapestMatch: null,
      matchCount: 0,
    }
  }

  const client = await serverSupabaseServiceRole(event)

  let restaurants: TenantRestaurant[] | null = null
  let rErr: unknown = null
  const r1 = await client
    .from('restaurants')
    .select('id,shop_id,city_id,name,address,supports_delivery,supports_pickup,supports_qr_menu,use_organization_working_hours,working_hours,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
  restaurants = r1.data as TenantRestaurant[] | null
  rErr = r1.error
  if (rErr && (rErr as { code?: string }).code === '42703') {
    const r2 = await client
      .from('restaurants')
      .select('id,shop_id,city_id,name,address,supports_delivery,supports_pickup,supports_qr_menu,is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
    restaurants = (r2.data as any[] | null)?.map((item) => ({
      ...item,
      use_organization_working_hours: true,
      working_hours: null,
    })) ?? null
    rErr = r2.error
  }

  if (rErr) {
    console.error('resolveDeliveryForPoint restaurants:', rErr)
    return {
      selected: null,
      reason: 'no_restaurants',
      switchedDueToClosed: false,
      cheapestMatch: null,
      matchCount: 0,
    }
  }

  const list = (restaurants ?? []).filter((r) => r.supports_delivery)
  if (!list.length) {
    return {
      selected: null,
      reason: 'no_restaurants',
      switchedDueToClosed: false,
      cheapestMatch: null,
      matchCount: 0,
    }
  }

  const restaurantById = new Map(list.map((r) => [r.id, r]))

  let zoneQuery = client
    .from('restaurant_delivery_zones')
    .select('id,restaurant_id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active,priority')
    .eq('shop_id', shopId)
    .eq('is_active', true)

  const zonesRes = await zoneQuery
  let zoneRows = (zonesRes.data ?? []) as ZoneRow[]

  if (zonesRes.error && /priority|column/i.test(String(zonesRes.error.message))) {
    const fallback = await client
      .from('restaurant_delivery_zones')
      .select('id,restaurant_id,name,polygon_geojson,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
    if (!fallback.error) {
      zoneRows = ((fallback.data ?? []) as any[]).map((z) => ({ ...z, priority: 0 }))
    }
  } else if (zonesRes.error) {
    console.error('resolveDeliveryForPoint zones:', zonesRes.error)
    zoneRows = []
  }

  const candidates: ResolvedDeliveryChoice[] = []

  for (const z of zoneRows) {
    const restaurant = restaurantById.get(z.restaurant_id)
    if (!restaurant) continue

    const coords = extractPolygonCoordinatesFromGeoJson(z.polygon_geojson)
    if (!coords || !pointInPolygon(point, coords)) continue

    const priority = typeof z.priority === 'number' && Number.isFinite(z.priority) ? z.priority : 0

    candidates.push({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      zoneId: z.id,
      zoneName: z.name,
      minOrderAmount: z.min_order_amount,
      deliveryCost: z.delivery_cost,
      freeDeliveryThreshold: z.free_delivery_threshold,
      priority,
    })
  }

  if (!candidates.length) {
    return {
      selected: null,
      reason: 'out_of_zone',
      switchedDueToClosed: false,
      cheapestMatch: null,
      matchCount: 0,
    }
  }

  const sorted = [...candidates].sort((a, b) => {
    const ka = sortKey({
      delivery_cost: a.deliveryCost,
      priority: a.priority,
      restaurantName: a.restaurantName,
      zoneId: a.zoneId,
    })
    const kb = sortKey({
      delivery_cost: b.deliveryCost,
      priority: b.priority,
      restaurantName: b.restaurantName,
      zoneId: b.zoneId,
    })
    return compareCandidates(ka, kb)
  })

  const cheapestMatch = sorted[0] ?? null

  function isRestaurantOpen(restaurant: TenantRestaurant): boolean {
    const branchWorkingHours = normalizeWeeklyWorkingHours(restaurant.working_hours, org.ops.workingHours)
    const effectiveWorkingHours = resolveEffectiveWorkingHours(org.ops.workingHours, {
      useOrganizationHours: restaurant.use_organization_working_hours !== false,
      workingHours: branchWorkingHours,
    })
    return isOpenNowBySchedule(effectiveWorkingHours, org.locale.timezone).isOpen
  }

  let selected: ResolvedDeliveryChoice | null = null
  for (const c of sorted) {
    const restaurant = restaurantById.get(c.restaurantId)
    if (!restaurant) continue
    if (!isRestaurantOpen(restaurant)) continue
    selected = c
    break
  }

  if (!selected) {
    return {
      selected: null,
      reason: 'all_closed',
      switchedDueToClosed: false,
      cheapestMatch,
      matchCount: sorted.length,
    }
  }

  const switchedDueToClosed =
    !!cheapestMatch
    && selected.zoneId !== cheapestMatch.zoneId

  return {
    selected,
    reason: 'ok',
    switchedDueToClosed,
    cheapestMatch,
    matchCount: sorted.length,
  }
}
