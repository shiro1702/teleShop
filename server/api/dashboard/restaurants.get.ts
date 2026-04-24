import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'
import { getDefaultOrganizationSettings, getOrganizationSettings } from '~/server/utils/organizationStyle'
import { normalizeWeeklyWorkingHours } from '~/utils/workingHours'

type RestaurantRow = {
  id: string
  name: string
  address: string
  lat: number | null
  lon: number | null
  supports_delivery: boolean
  supports_pickup: boolean
  supports_dine_in: boolean
  supports_qr_menu: boolean
  supports_showcase_order: boolean
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
  const [org, client] = await Promise.all([
    getOrganizationSettings(event, access.shopId),
    serverSupabaseServiceRole(event),
  ])
  const allowedModes = await applyGlobalFulfillmentPolicy(event, access.shopId, org.ops.fulfillmentTypes)
  const allowedSet = new Set(allowedModes)
  const hallMode = org.ops.dineInHallMode
  const hallOrderingEnabled = allowedSet.has('dine-in') && hallMode !== 'qr-menu-browse'
  let data: RestaurantFallbackRow[] | null = null
  let error: any = null
  const runRestaurantsQuery = async (mode: RestaurantSelectMode) => {
    const selectByMode: Record<RestaurantSelectMode, string> = {
      primary: 'id,name,address,lat,lon,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,use_organization_working_hours,working_hours,is_active,created_at',
      fallback: 'id,name,address,lat,lon,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active,created_at',
      legacy: 'id,name,address,lat,lon,supports_delivery,supports_pickup,supports_dine_in,is_active,created_at',
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
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
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
      useOrganizationWorkingHours: row.use_organization_working_hours !== false,
      workingHours: normalizeWeeklyWorkingHours(row.working_hours, fallbackWorkingHours),
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  }
})
