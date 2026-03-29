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

  const { error } = await client
    .from('parameter_kinds')
    .delete()
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (error) {
    console.error('Failed to delete parameter kind:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete parameter kind' })
  }

  return { ok: true }
})
