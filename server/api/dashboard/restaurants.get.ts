import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'
import { getDefaultOrganizationSettings } from '~/server/utils/organizationStyle'
import { normalizeWeeklyWorkingHours } from '~/utils/workingHours'

type RestaurantRow = {
  id: string
  name: string
  address: string
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

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const allowedModes = await applyGlobalFulfillmentPolicy(event, access.shopId, ['delivery', 'pickup', 'dine-in', 'qr-menu', 'showcase-order'])
  const allowedSet = new Set(allowedModes)
  const client = await serverSupabaseServiceRole(event)
  let data: RestaurantRow[] | null = null
  let error: any = null
  const primary = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,use_organization_working_hours,working_hours,is_active,created_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
  data = primary.data as RestaurantRow[] | null
  error = primary.error
  if (error && error.code === '42703') {
    const fallback = await client
      .from('restaurants')
      .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active,created_at')
      .eq('shop_id', access.shopId)
      .order('created_at', { ascending: false })
    data = (fallback.data as RestaurantRow[] | null)?.map((row) => ({
      ...row,
      use_organization_working_hours: true,
      working_hours: null,
    })) ?? []
    error = fallback.error
  }

  if (error) {
    console.error('Failed to load dashboard restaurants:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load restaurants' })
  }

  const rows = (data ?? []) as RestaurantRow[]
  const fallbackWorkingHours = getDefaultOrganizationSettings().ops.workingHours
  return {
    ok: true,
    shopId: access.shopId,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      supportsDelivery: row.supports_delivery && allowedSet.has('delivery'),
      supportsPickup: row.supports_pickup && allowedSet.has('pickup'),
      supportsDineIn: row.supports_dine_in && allowedSet.has('dine-in'),
      supportsQrMenu: row.supports_qr_menu && allowedSet.has('qr-menu'),
      supportsShowcaseOrder: row.supports_showcase_order && allowedSet.has('showcase-order'),
      useOrganizationWorkingHours: row.use_organization_working_hours !== false,
      workingHours: normalizeWeeklyWorkingHours(row.working_hours, fallbackWorkingHours),
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  }
})
