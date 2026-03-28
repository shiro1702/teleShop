import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type UpdateBranchBody = {
  name?: string
  address?: string
  supportsDelivery?: boolean
  supportsPickup?: boolean
  supportsDineIn?: boolean
  supportsQrMenu?: boolean
  supportsShowcaseOrder?: boolean
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
  const update = await client
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
      isActive: update.data.is_active,
    },
  }
})
