import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const restaurantId = event.context.params?.id

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

  // Get all active products
  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, name, price, category_id, is_active, sort_order, categories(id, name)')
    .eq('shop_id', access.shopId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (productsError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load products' })
  }

  // Get overrides for this restaurant
  const { data: overrides, error: overridesError } = await client
    .from('restaurant_product_overrides')
    .select('product_id, price_override, is_hidden, is_in_stop_list')
    .eq('restaurant_id', restaurantId)
    .eq('shop_id', access.shopId)

  if (overridesError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load overrides' })
  }

  const overridesMap = new Map((overrides ?? []).map(o => [o.product_id, o]))

  return {
    ok: true,
    items: (products ?? []).map((p: any) => {
      const override = overridesMap.get(p.id)
      return {
        id: p.id,
        name: p.name,
        basePrice: p.price,
        categoryId: p.category_id,
        categoryName: p.categories?.name,
        sortOrder: p.sort_order,
        priceOverride: override?.price_override ?? null,
        isHidden: override?.is_hidden ?? false,
        isInStopList: override?.is_in_stop_list ?? false
      }
    })
  }
})
