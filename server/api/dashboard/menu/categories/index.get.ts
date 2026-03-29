import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('categories')
    .select(`
      id, name, sort_order, is_active, external_id, created_at,
      category_modifier_groups(group_id),
      category_parameter_kinds(parameter_kind_id)
    `)
    .eq('shop_id', access.shopId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load categories:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load categories' })
  }

  // Count products per category
  const { data: productsData, error: productsError } = await client
    .from('products')
    .select('category_id')
    .eq('shop_id', access.shopId)
    .not('category_id', 'is', null)

  const productCounts: Record<string, number> = {}
  if (!productsError && productsData) {
    for (const p of productsData) {
      if (p.category_id) {
        productCounts[p.category_id] = (productCounts[p.category_id] || 0) + 1
      }
    }
  }

  return {
    ok: true,
    items: (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      externalId: row.external_id,
      createdAt: row.created_at,
      productsCount: productCounts[row.id] || 0,
      modifierGroupIds: row.category_modifier_groups?.map((g: any) => g.group_id) || [],
      parameterKindIds: row.category_parameter_kinds?.map((pk: any) => pk.parameter_kind_id) || []
    }))
  }
})
