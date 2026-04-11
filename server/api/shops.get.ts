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
  supports_delivery: boolean
  supports_pickup: boolean
  city_id: string
  is_active: boolean
}

function normalizeRestaurants(raw: ShopRow['restaurants']): ShopRestaurantRow[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter((r): r is ShopRestaurantRow => !!r && typeof r === 'object' && typeof (r as ShopRestaurantRow).id === 'string')
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

  const { data, error } = await client
    .from('shops')
    .select('id,slug,name,ui_settings,is_active,restaurants!restaurants_shop_id_fkey!inner(id,name,address,city_id,is_active,supports_delivery,supports_pickup)')
    .eq('is_active', true)
    .eq('restaurants.city_id', cityId)
    .eq('restaurants.is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load shops:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants list' })
  }

  const rows = (data ?? []) as ShopRow[]

  const firstByShop = new Map<string, ShopRow>()
  const fulfillmentAgg = new Map<string, {
    hasDelivery: boolean
    hasPickup: boolean
    pickupRestaurantIds: Set<string>
    pickupPoints: Array<{ name: string, address: string }>
  }>()

  for (const row of rows) {
    if (!firstByShop.has(row.id)) firstByShop.set(row.id, row)

    let agg = fulfillmentAgg.get(row.id)
    if (!agg) {
      agg = {
        hasDelivery: false,
        hasPickup: false,
        pickupRestaurantIds: new Set<string>(),
        pickupPoints: [],
      }
      fulfillmentAgg.set(row.id, agg)
    }

    for (const r of normalizeRestaurants(row.restaurants)) {
      if (r.supports_delivery) agg.hasDelivery = true
      if (r.supports_pickup && !agg.pickupRestaurantIds.has(r.id)) {
        agg.pickupRestaurantIds.add(r.id)
        agg.hasPickup = true
        agg.pickupPoints.push({ name: r.name, address: r.address })
      }
    }
  }

  const uniqueRows = Array.from(firstByShop.values())

  // MVP: берём name/description/logo не из `shops.ui_settings`, а из `organization_style_settings`,
  // чтобы карточки на странице города отражали настройку бренда.
  const items = await Promise.all(uniqueRows.map(async (row) => {
    const agg = fulfillmentAgg.get(row.id)
    let fulfillment: { delivery: boolean, pickup: boolean } = {
      delivery: Boolean(agg?.hasDelivery),
      pickup: Boolean(agg?.hasPickup),
    }
    let pickupPoints: Array<{ name: string, address: string }> = []

    try {
      const org = await getOrganizationSettings(event, row.id)
      const modes = new Set(org.ops.fulfillmentTypes)
      fulfillment = {
        delivery: modes.has('delivery') && Boolean(agg?.hasDelivery),
        pickup: modes.has('pickup') && Boolean(agg?.hasPickup),
      }
      pickupPoints = fulfillment.pickup && agg?.pickupPoints?.length ? agg.pickupPoints : []
    } catch {
      pickupPoints = fulfillment.pickup && agg?.pickupPoints?.length ? agg.pickupPoints : []
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
      }
    }
  }))
  return {
    ok: true,
    items,
  }
})

