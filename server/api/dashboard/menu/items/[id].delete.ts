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

  // We could check if it's in active orders, but for MVP we might just delete or archive.
  // The DB has ON DELETE CASCADE for some things, but orders might have a snapshot.
  // Let's just delete it.

  const { error } = await client
    .from('products')
    .delete()
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (error) {
    console.error('Failed to delete item:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete item' })
  }

  return { ok: true }
})
