import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getDefaultOrganizationSettings } from '~/server/utils/organizationStyle'
import { normalizeWeeklyWorkingHours } from '~/utils/workingHours'

type UpdateBranchBody = {
  name?: string
  address?: string
  supportsDelivery?: boolean
  supportsPickup?: boolean
  supportsDineIn?: boolean
  supportsQrMenu?: boolean
  supportsShowcaseOrder?: boolean
  useOrganizationWorkingHours?: boolean
  workingHours?: unknown
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can update branch settings' })
  }
  const branchId = getRouterParam(event, 'id')
  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })
  }
  const body = await readBody<UpdateBranchBody>(event)
  const name = body?.name?.trim()
  const address = body?.address?.trim()
  if (!name || !address) {
    throw createError({ statusCode: 400, statusMessage: 'name and address are required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const fallbackWorkingHours = getDefaultOrganizationSettings().ops.workingHours
  const normalizedWorkingHours = normalizeWeeklyWorkingHours(body?.workingHours, fallbackWorkingHours)
  let update = await client
    .from('restaurants')
    .update({
      name,
      address,
      supports_delivery: body?.supportsDelivery === true,
      supports_pickup: body?.supportsPickup === true,
      supports_dine_in: body?.supportsDineIn === true,
      supports_qr_menu: body?.supportsQrMenu === true,
      supports_showcase_order: body?.supportsShowcaseOrder === true,
      use_organization_working_hours: body?.useOrganizationWorkingHours !== false,
      working_hours: normalizedWorkingHours,
    })
    .eq('id', branchId)
    .eq('shop_id', access.shopId)
    .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,use_organization_working_hours,working_hours,is_active')
    .maybeSingle()
  if (update.error && (update.error as any).code === '42703') {
    update = await client
      .from('restaurants')
      .update({
        name,
        address,
        supports_delivery: body?.supportsDelivery === true,
        supports_pickup: body?.supportsPickup === true,
        supports_dine_in: body?.supportsDineIn === true,
        supports_qr_menu: body?.supportsQrMenu === true,
        supports_showcase_order: body?.supportsShowcaseOrder === true,
      })
      .eq('id', branchId)
      .eq('shop_id', access.shopId)
      .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active')
      .maybeSingle()
    if (update.data) {
      ;(update.data as any).use_organization_working_hours = true
      ;(update.data as any).working_hours = fallbackWorkingHours
    }
  }

  if (update.error || !update.data) {
    throw createError({ statusCode: 400, statusMessage: update.error?.message || 'Failed to update branch' })
  }

  return {
    ok: true,
    item: {
      id: update.data.id,
      name: update.data.name,
      address: update.data.address,
      supportsDelivery: update.data.supports_delivery,
      supportsPickup: update.data.supports_pickup,
      supportsDineIn: update.data.supports_dine_in,
      supportsQrMenu: update.data.supports_qr_menu,
      supportsShowcaseOrder: update.data.supports_showcase_order,
      useOrganizationWorkingHours: update.data.use_organization_working_hours !== false,
      workingHours: normalizeWeeklyWorkingHours(update.data.working_hours, fallbackWorkingHours),
      isActive: update.data.is_active,
    },
  }
})
