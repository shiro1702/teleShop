import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const id = event.context.params?.id

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  // Check if used in products
  const { count: productCount, error: productCountError } = await client
    .from('product_modifier_groups')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  if (productCountError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check modifier usage in products' })
  }

  if (productCount && productCount > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete modifier group used in products' })
  }

  // Check if used in categories
  const { count: categoryCount, error: categoryCountError } = await client
    .from('category_modifier_groups')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  if (categoryCountError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check modifier usage in categories' })
  }

  if (categoryCount && categoryCount > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete modifier group used in categories' })
  }

  const { error } = await client
    .from('modifier_groups')
    .delete()
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (error) {
    console.error('Failed to delete modifier group:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete modifier group' })
  }

  return { ok: true }
})
