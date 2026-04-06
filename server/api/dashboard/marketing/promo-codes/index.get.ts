import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('shop_promo_codes')
    .select('*')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('marketing promo-codes list:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load promo codes' })
  }

  return { ok: true, items: data ?? [] }
})
