import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('parameter_kinds')
    .select(`
      id, code, name, sort_order,
      parameter_options(id, name, weight_g, volume_ml, pieces, is_active, sort_order, external_id)
    `)
    .eq('shop_id', access.shopId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to load parameter kinds:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load parameter kinds' })
  }

  // Sort options
  const items = data?.map((kind: any) => ({
    ...kind,
    parameter_options: (kind.parameter_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  }))

  return { ok: true, items }
})
