import { createError, defineEventHandler, readBody } from 'h3'
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
  const body = await readBody<Body>(event)
  const code = normalizePromoCode(typeof body?.code === 'string' ? body.code : '')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Code is required' })
  }
  const type = body?.type
  if (type !== 'percent' && type !== 'fixed' && type !== 'free_item') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('shop_promo_codes')
    .insert({
      shop_id: access.shopId,
      code,
      type,
      value: Math.max(0, Math.floor(Number(body?.value ?? 0))),
      min_order_amount: Math.max(0, Math.floor(Number(body?.min_order_amount ?? 0))),
      starts_at: body?.starts_at || null,
      ends_at: body?.ends_at || null,
      max_uses_total: body?.max_uses_total == null ? null : Math.max(1, Math.floor(Number(body.max_uses_total))),
      max_uses_per_user: body?.max_uses_per_user == null ? null : Math.max(1, Math.floor(Number(body.max_uses_per_user))),
      is_active: body?.is_active !== false,
      free_item_product_id: type === 'free_item' ? body?.free_item_product_id?.trim() || null : null,
      free_item_parameter_option_id:
        type === 'free_item' ? body?.free_item_parameter_option_id?.trim() || null : null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('marketing promo create:', error)
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to create promo' })
  }

  return { ok: true, item: data }
})
