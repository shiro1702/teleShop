import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const [
    productLinksRes,
    categoryLinksRes,
    globalCategoriesRes,
  ] = await Promise.all([
    client
      .from('cart_cross_sell_product_links')
      .select('id,source_product_id,target_product_id,sort_order,created_at,updated_at')
      .eq('shop_id', access.shopId)
      .order('sort_order', { ascending: true }),
    client
      .from('cart_cross_sell_category_links')
      .select('id,source_category_id,target_category_id,sort_order,created_at,updated_at')
      .eq('shop_id', access.shopId)
      .order('sort_order', { ascending: true }),
    client
      .from('cart_cross_sell_global_categories')
      .select('id,target_category_id,sort_order,created_at,updated_at')
      .eq('shop_id', access.shopId)
      .order('sort_order', { ascending: true }),
  ])

  if (productLinksRes.error || categoryLinksRes.error || globalCategoriesRes.error) {
    console.error('Failed to load cross-sell rules:', {
      productLinksError: productLinksRes.error,
      categoryLinksError: categoryLinksRes.error,
      globalCategoriesError: globalCategoriesRes.error,
    })
    throw createError({ statusCode: 500, statusMessage: 'Failed to load cross-sell rules' })
  }

  return {
    ok: true,
    productLinks: (productLinksRes.data ?? []).map((row: any) => ({
      id: row.id,
      sourceProductId: row.source_product_id,
      targetProductId: row.target_product_id,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    categoryLinks: (categoryLinksRes.data ?? []).map((row: any) => ({
      id: row.id,
      sourceCategoryId: row.source_category_id,
      targetCategoryId: row.target_category_id,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    globalCategories: (globalCategoriesRes.data ?? []).map((row: any) => ({
      id: row.id,
      targetCategoryId: row.target_category_id,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
})
