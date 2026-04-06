import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { normalizePromoCode } from '~/server/utils/pricingPromoBonus'

type Body = {
  code?: string
  type?: 'percent' | 'fixed' | 'free_item'
  value?: number
  min_order_amount?: number
  starts_at?: string | null
  ends_at?: string | null
  max_uses_total?: number | null
  max_uses_per_user?: number | null
  is_active?: boolean
  free_item_product_id?: string | null
  free_item_parameter_option_id?: string | null
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')?.trim() || ''
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }
  const body = await readBody<Body>(event)
  const client = await serverSupabaseServiceRole(event)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.code === 'string') {
    const c = normalizePromoCode(body.code)
    if (!c) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid code' })
    }
    patch.code = c
  }
  if (body.type === 'percent' || body.type === 'fixed' || body.type === 'free_item') {
    patch.type = body.type
  }
  if (typeof body.value === 'number') patch.value = Math.max(0, Math.floor(body.value))
  if (typeof body.min_order_amount === 'number') patch.min_order_amount = Math.max(0, Math.floor(body.min_order_amount))
  if ('starts_at' in body) patch.starts_at = body.starts_at || null
  if ('ends_at' in body) patch.ends_at = body.ends_at || null
  if ('max_uses_total' in body) {
    patch.max_uses_total = body.max_uses_total == null ? null : Math.max(1, Math.floor(Number(body.max_uses_total)))
  }
  if ('max_uses_per_user' in body) {
    patch.max_uses_per_user =
      body.max_uses_per_user == null ? null : Math.max(1, Math.floor(Number(body.max_uses_per_user)))
  }
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if ('free_item_product_id' in body) patch.free_item_product_id = body.free_item_product_id?.trim() || null
  if ('free_item_parameter_option_id' in body) {
    patch.free_item_parameter_option_id = body.free_item_parameter_option_id?.trim() || null
  }

  const { data, error } = await client
    .from('shop_promo_codes')
    .update(patch)
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('marketing promo update:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update promo' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Promo not found' })
  }

  return { ok: true, item: data }
})
