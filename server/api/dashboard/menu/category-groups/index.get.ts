import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('menu_category_groups')
    .select('id, name, sort_order, created_at')
    .eq('shop_id', access.shopId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load menu category groups:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load menu category groups' })
  }

  return {
    ok: true,
    items: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    })),
  }
})
