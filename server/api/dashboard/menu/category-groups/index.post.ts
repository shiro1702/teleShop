import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const name = body.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const { data, error } = await client
    .from('menu_category_groups')
    .insert({
      shop_id: access.shopId,
      name,
      sort_order: body.sortOrder ?? 0,
    })
    .select('id, name, sort_order, created_at')
    .single()

  if (error) {
    console.error('Failed to create menu category group:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create menu category group' })
  }

  return {
    ok: true,
    item: {
      id: data.id,
      name: data.name,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
    },
  }
})
