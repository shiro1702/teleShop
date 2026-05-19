import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getDefaultOrganizationSettings, getOrganizationSettings } from '~/server/utils/organizationStyle'
import { normalizeWeeklyWorkingHours } from '~/utils/workingHours'

type RestaurantRow = {
  id: string
  name: string
  address: string
  city_id: string | null
  cities?: { name?: string | null } | Array<{ name?: string | null }> | null
  lat: number | null
  lon: number | null
  supports_delivery: boolean
  supports_pickup: boolean
  supports_dine_in: boolean
  supports_qr_menu: boolean
  supports_showcase_order: boolean
  festival_id: string | null
  is_festival: boolean
  festival_fulfillment_type: 'delivery' | 'pickup' | 'dine-in' | null
  use_organization_working_hours: boolean
  working_hours: unknown
  is_active: boolean
  created_at: string
}
type RestaurantFallbackRow = Partial<RestaurantRow> & Pick<RestaurantRow, 'id' | 'name' | 'address' | 'is_active' | 'created_at'>
type RestaurantSelectMode = 'primary' | 'fallback' | 'legacy'

let cachedRestaurantsSelectMode: RestaurantSelectMode = 'primary'

function isMissingColumnError(error: any): boolean {
  if (!error || typeof error !== 'object') return false
  const code = typeof error.code === 'string' ? error.code : ''
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  const details = typeof error.details === 'string' ? error.details.toLowerCase() : ''
  return (
    code === '42703'
    || code === 'PGRST204'
    || message.includes('column')
    || details.includes('column')
  )
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const query = getQuery(event)
  const compact = query.compact === '1' || query.compact === 'true'
  const branchList = query.branchList === '1' || query.branchList === 'true'
  const clientPromise = serverSupabaseServiceRole(event)

  if (compact) {
    const client = await clientPromise
    const page = Math.max(Number(query.page) || 1, 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 100, 1), 200)
    const from = (page - 1) * pageSize
    const to = from + pageSize
    const { data, error } = await client
      .from('restaurants')
      .select('id,name')
      .eq('shop_id', access.shopId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) {
      console.error('Failed to load compact dashboard restaurants:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load restaurants' })
    }
    const rows = data ?? []
    return {
      ok: true,
      shopId: access.shopId,
      items: rows.slice(0, pageSize).map((row: any) => ({
        id: row.id,
        name: row.name,
      })),
      pagination: {
        page,
        pageSize,
        hasNext: rows.length > pageSize,
        hasPrev: page > 1,
      },
    }
  }

  if (branchList) {
    const client = await clientPromise
    const { data, error } = await client
      .from('restaurants')
      .select('id,name,address,city_id,cities(name),is_active,created_at')
      .eq('shop_id', access.shopId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to load branch-list dashboard restaurants:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load restaurants' })
    }
    return {
      ok: true,
      shopId: access.shopId,
      items: (data ?? []).map((row: any) => {
        const cityRow = Array.isArray(row.cities) ? row.cities[0] : row.cities
        const cityName = typeof cityRow?.name === 'string' && cityRow.name.trim().length
          ? cityRow.name.trim()
          : null
        return {
          id: row.id,
          name: row.name,
          address: row.address,
          cityId: typeof row.city_id === 'string' ? row.city_id : null,
          cityName,
          isActive: row.is_active === true,
          createdAt: row.created_at,
        }
      }),
    }
  }

  const [org, client] = await Promise.all([
    getOrganizationSettings(event, access.shopId),
    clientPromise,
  ])
  const allowedSet = new Set(org.ops.fulfillmentTypes)
  const hallMode = org.ops.dineInHallMode
  const hallOrderingEnabled = allowedSet.has('dine-in') && hallMode !== 'qr-menu-browse'
  let data: RestaurantFallbackRow[] | null = null
  let error: any = null
  const runRestaurantsQuery = async (mode: RestaurantSelectMode) => {
    const selectByMode: Record<RestaurantSelectMode, string> = {
      primary: 'id,name,address,city_id,cities(name),lat,lon,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,festival_id,is_festival,festival_fulfillment_type,use_organization_working_hours,working_hours,is_active,created_at',
      fallback: 'id,name,address,city_id,cities(name),lat,lon,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active,created_at',
      legacy: 'id,name,address,city_id,cities(name),lat,lon,supports_delivery,supports_pickup,supports_dine_in,is_active,created_at',
    }
    return client
      .from('restaurants')
      .select(selectByMode[mode])
      .eq('shop_id', access.shopId)
      .order('created_at', { ascending: false })
  }

  const modesInOrder: RestaurantSelectMode[] = ['primary', 'fallback', 'legacy']
  const startIndex = modesInOrder.indexOf(cachedRestaurantsSelectMode)
  const modesToTry = [...modesInOrder.slice(startIndex), ...modesInOrder.slice(0, startIndex)]

  for (const mode of modesToTry) {
    const result = await runRestaurantsQuery(mode)
    data = result.data as RestaurantFallbackRow[] | null
    error = result.error

    if (!error) {
      cachedRestaurantsSelectMode = mode
      break
    }

    if (!isMissingColumnError(error)) {
      break
    }
  }

  if (error) {
    console.error('Failed to load dashboard restaurants:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load restaurants' })
  }

  const rows = (data ?? []) as RestaurantFallbackRow[]
  const fallbackWorkingHours = getDefaultOrganizationSettings().ops.workingHours
  return {
    ok: true,
    shopId: access.shopId,
    items: rows.map((row) => {
      const cityRow = Array.isArray(row.cities) ? row.cities[0] : row.cities
      const cityName = typeof cityRow?.name === 'string' && cityRow.name.trim().length
        ? cityRow.name.trim()
        : null
      return {
      id: row.id,
      name: row.name,
      address: row.address,
      cityId: typeof row.city_id === 'string' ? row.city_id : null,
      cityName,
      lat: typeof row.lat === 'number' && Number.isFinite(row.lat) ? row.lat : null,
      lon: typeof row.lon === 'number' && Number.isFinite(row.lon) ? row.lon : null,
      supportsDelivery: row.supports_delivery === true && allowedSet.has('delivery'),
      supportsPickup: row.supports_pickup === true && allowedSet.has('pickup'),
      supportsDineIn: row.supports_dine_in === true && allowedSet.has('dine-in'),
      supportsQrMenu:
        row.supports_qr_menu === true
        && hallOrderingEnabled
        && hallMode === 'to-table',
      supportsShowcaseOrder:
        row.supports_showcase_order === true
        && hallOrderingEnabled
        && hallMode === 'pickup-point',
      festivalId: typeof row.festival_id === 'string' ? row.festival_id : null,
      isFestival: row.is_festival === true,
      festivalFulfillmentType: ['delivery', 'pickup', 'dine-in'].includes(String(row.festival_fulfillment_type))
        ? row.festival_fulfillment_type
        : null,
      useOrganizationWorkingHours: row.use_organization_working_hours !== false,
      workingHours: normalizeWeeklyWorkingHours(row.working_hours, fallbackWorkingHours),
      isActive: row.is_active,
      createdAt: row.created_at,
      }
    }),
  }
})
