import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const id = event.context.params?.id
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) {
    const name = body.name?.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
    updates.name = name
  }
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder

  const { data, error } = await client
    .from('menu_category_groups')
    .update(updates)
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select('id, name, sort_order, created_at')
    .single()

  if (error) {
    console.error('Failed to update menu category group:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update menu category group' })
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
