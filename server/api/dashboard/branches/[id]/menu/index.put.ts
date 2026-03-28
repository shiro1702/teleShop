import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const restaurantId = event.context.params?.id
  const body = await readBody(event)

  if (!restaurantId) {
    throw createError({ statusCode: 400, statusMessage: 'Restaurant ID is required' })
  }

  // Verify restaurant belongs to shop
  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('shop_id', access.shopId)
    .single()

  if (restaurantError || !restaurant) {
    throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })
  }

  if (!Array.isArray(body.overrides)) {
    throw createError({ statusCode: 400, statusMessage: 'Overrides array is required' })
  }

  // We can upsert overrides
  const overridesToUpsert = body.overrides.map((o: any) => ({
    shop_id: access.shopId,
    restaurant_id: restaurantId,
    product_id: o.productId,
    price_override: o.priceOverride ?? null,
    is_hidden: o.isHidden ?? false,
    is_in_stop_list: o.isInStopList ?? false,
    updated_at: new Date().toISOString()
  }))

  if (overridesToUpsert.length > 0) {
    const { error } = await client
      .from('restaurant_product_overrides')
      .upsert(overridesToUpsert, { onConflict: 'restaurant_id,product_id' })

    if (error) {
      console.error('Failed to update overrides:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to update overrides' })
    }
  }

  return { ok: true }
})
