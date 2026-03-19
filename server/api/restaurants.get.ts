import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load restaurants by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants' })
  }

  return {
    ok: true,
    shopId,
    items: data ?? [],
  }
})
