import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getOrganizationSettings, getStyleRecord } from '~/server/utils/organizationStyle'

type ShopRow = {
  id: string
  slug: string
  name: string
  ui_settings: Record<string, unknown> | null
  is_active: boolean
  restaurants?: ShopRestaurantRow | ShopRestaurantRow[]
}

type ShopRestaurantRow = {
  id: string
  name: string
  address: string
  lat: number | null
  lon: number | null
  supports_delivery: boolean
  supports_pickup: boolean
  supports_dine_in: boolean
  city_id: string
  is_active: boolean
}

function normalizeRestaurants(raw: ShopRow['restaurants']): ShopRestaurantRow[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .filter((r): r is ShopRestaurantRow => !!r && typeof r === 'object' && typeof (r as ShopRestaurantRow).id === 'string')
    .map((r) => ({
      ...r,
      supports_dine_in: Boolean((r as ShopRestaurantRow).supports_dine_in),
    }))
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig(event)
  const requestedCitySlug = typeof query.city_slug === 'string' ? query.city_slug.trim() : ''
  const defaultCitySlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug.trim() : ''
  const citySlug = requestedCitySlug || defaultCitySlug

  if (!citySlug) {
    throw createError({ statusCode: 400, message: 'city_slug is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: cityData, error: cityError } = await client
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .maybeSingle()

  if (cityError) {
    console.error('Failed to resolve city slug:', cityError)
    throw createError({ statusCode: 500, message: 'Failed to resolve city' })
  }

  if (!cityData?.id) {
    return { ok: true, items: [] }
  }

  const cityId = cityData.id as string

  let data: ShopRow[] | null = null
  let error: { code?: string, message?: string } | null = null

  const primary = await client
    .from('shops')
    .select('id,slug,name,ui_settings,is_active,restaurants!restaurants_shop_id_fkey!inner(id,name,address,lat,lon,city_id,is_active,supports_delivery,supports_pickup,supports_dine_in)')
    .eq('is_active', true)
    .eq('restaurants.city_id', cityId)
    .eq('restaurants.is_active', true)
    .order('name', { ascending: true })

  data = primary.data as ShopRow[] | null
  error = primary.error

  if (error && error.code === '42703') {
    const fallback = await client
      .from('shops')
      .select('id,slug,name,ui_settings,is_active,restaurants!restaurants_shop_id_fkey!inner(id,name,address,lat,lon,city_id,is_active,supports_delivery,supports_pickup)')
      .eq('is_active', true)
      .eq('restaurants.city_id', cityId)
      .eq('restaurants.is_active', true)
      .order('name', { ascending: true })
    data = (fallback.data as ShopRow[] | null)?.map((row) => ({
      ...row,
      restaurants: normalizeRestaurants(row.restaurants).map((r) => ({ ...r, supports_dine_in: false })),
    })) ?? null
    error = fallback.error
  }

  if (error) {
    console.error('Failed to load shops:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants list' })
  }

  const rows = (data ?? []) as ShopRow[]

  const firstByShop = new Map<string, ShopRow>()
  const fulfillmentAgg = new Map<string, {
    hasDelivery: boolean
    hasPickup: boolean
    hasDineIn: boolean
    pickupRestaurantIds: Set<string>
    dineInRestaurantIds: Set<string>
    pickupPoints: Array<{ restaurantId: string, name: string, address: string, lat: number | null, lon: number | null }>
    dineInPoints: Array<{ restaurantId: string, name: string, address: string, lat: number | null, lon: number | null }>
  }>()

  for (const row of rows) {
    if (!firstByShop.has(row.id)) firstByShop.set(row.id, row)

    let agg = fulfillmentAgg.get(row.id)
    if (!agg) {
      agg = {
        hasDelivery: false,
        hasPickup: false,
        hasDineIn: false,
        pickupRestaurantIds: new Set<string>(),
        dineInRestaurantIds: new Set<string>(),
        pickupPoints: [],
        dineInPoints: [],
      }
      fulfillmentAgg.set(row.id, agg)
    }

    for (const r of normalizeRestaurants(row.restaurants)) {
      if (r.supports_delivery) agg.hasDelivery = true
      if (r.supports_pickup && !agg.pickupRestaurantIds.has(r.id)) {
        agg.pickupRestaurantIds.add(r.id)
        agg.hasPickup = true
        agg.pickupPoints.push({
          restaurantId: r.id,
          name: r.name,
          address: r.address,
          lat: typeof r.lat === 'number' && Number.isFinite(r.lat) ? r.lat : null,
          lon: typeof r.lon === 'number' && Number.isFinite(r.lon) ? r.lon : null,
        })
      }
      if (r.supports_dine_in && !agg.dineInRestaurantIds.has(r.id)) {
        agg.dineInRestaurantIds.add(r.id)
        agg.hasDineIn = true
        agg.dineInPoints.push({
          restaurantId: r.id,
          name: r.name,
          address: r.address,
          lat: typeof r.lat === 'number' && Number.isFinite(r.lat) ? r.lat : null,
          lon: typeof r.lon === 'number' && Number.isFinite(r.lon) ? r.lon : null,
        })
      }
    }
  }

  const uniqueRows = Array.from(firstByShop.values())

  // MVP: берём name/description/logo не из `shops.ui_settings`, а из `organization_style_settings`,
  // чтобы карточки на странице города отражали настройку бренда.
  const items = await Promise.all(uniqueRows.map(async (row) => {
    const agg = fulfillmentAgg.get(row.id)
    let fulfillment: { delivery: boolean, pickup: boolean, dineIn: boolean } = {
      delivery: Boolean(agg?.hasDelivery),
      pickup: Boolean(agg?.hasPickup),
      dineIn: Boolean(agg?.hasDineIn),
    }
    let pickupPoints: Array<{ restaurantId: string, name: string, address: string, lat: number | null, lon: number | null }> = []
    let dineInPoints: Array<{ restaurantId: string, name: string, address: string, lat: number | null, lon: number | null }> = []

    try {
      const org = await getOrganizationSettings(event, row.id)
      const modes = new Set(org.ops.fulfillmentTypes)
      fulfillment = {
        delivery: modes.has('delivery') && Boolean(agg?.hasDelivery),
        pickup: modes.has('pickup') && Boolean(agg?.hasPickup),
        dineIn: modes.has('dine-in') && Boolean(agg?.hasDineIn),
      }
      pickupPoints = fulfillment.pickup && agg?.pickupPoints?.length ? agg.pickupPoints : []
      dineInPoints = fulfillment.dineIn && agg?.dineInPoints?.length ? agg.dineInPoints : []
    } catch {
      pickupPoints = fulfillment.pickup && agg?.pickupPoints?.length ? agg.pickupPoints : []
      dineInPoints = fulfillment.dineIn && agg?.dineInPoints?.length ? agg.dineInPoints : []
    }

    try {
      const record = await getStyleRecord(event, row.id)
      const cfg = record.config

      return {
        id: row.id,
        slug: row.slug,
        name: cfg.identity.name || row.name,
        logoUrl: cfg.identity.logoUrl || (typeof row.ui_settings?.logo_url === 'string' ? row.ui_settings?.logo_url : null),
        description: cfg.identity.shortDescription || (typeof row.ui_settings?.description === 'string' ? row.ui_settings?.description : null),
        fulfillment,
        pickupPoints,
        dineInPoints,
      }
    } catch {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: typeof row.ui_settings?.logo_url === 'string' ? row.ui_settings?.logo_url : null,
        description: typeof row.ui_settings?.description === 'string' ? row.ui_settings?.description : null,
        fulfillment,
        pickupPoints,
        dineInPoints,
      }
    }
  }))
  return {
    ok: true,
    items,
  }
})

