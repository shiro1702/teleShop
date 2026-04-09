import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  restaurantId?: string
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can unlink chat' })
  }

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : ''
  if (!restaurantId) {
    throw createError({ statusCode: 400, statusMessage: 'restaurantId is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { error } = await client
    .from('restaurants')
    .update({ manager_group_chat_id: null })
    .eq('id', restaurantId)
    .eq('shop_id', access.shopId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to unlink telegram chat' })
  }

  return { ok: true }
})
