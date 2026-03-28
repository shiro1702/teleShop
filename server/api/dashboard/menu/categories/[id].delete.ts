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

  // Check if category has products
  const { count, error: countError } = await client
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('shop_id', access.shopId)

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check products' })
  }

  if (count && count > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete category with products' })
  }

  const { error } = await client
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (error) {
    console.error('Failed to delete category:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete category' })
  }

  return { ok: true }
})
