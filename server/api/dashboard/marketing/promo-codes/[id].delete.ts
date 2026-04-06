import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')?.trim() || ''
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { error } = await client
    .from('shop_promo_codes')
    .delete()
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (error) {
    console.error('marketing promo delete:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete promo' })
  }

  return { ok: true }
})
