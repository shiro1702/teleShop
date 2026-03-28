import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type RestaurantRow = {
  id: string
  name: string
  address: string
  supports_delivery: boolean
  supports_pickup: boolean
  is_active: boolean
  created_at: string
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,is_active,created_at')
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
      supportsDelivery: row.supports_delivery,
      supportsPickup: row.supports_pickup,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  }
})
