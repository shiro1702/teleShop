import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'

type RestaurantRow = {
  id: string
  name: string
  address: string
  supports_delivery: boolean
  supports_pickup: boolean
  supports_dine_in: boolean
  supports_qr_menu: boolean
  supports_showcase_order: boolean
  is_active: boolean
  created_at: string
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const allowedModes = await applyGlobalFulfillmentPolicy(event, access.shopId, ['delivery', 'pickup', 'dine-in', 'qr-menu', 'showcase-order'])
  const allowedSet = new Set(allowedModes)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active,created_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load dashboard restaurants:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load restaurants' })
  }

  const rows = (data ?? []) as RestaurantRow[]
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
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  }
})
