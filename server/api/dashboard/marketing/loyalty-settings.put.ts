import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  bonuses_enabled?: boolean
  allow_simultaneous_bonus_spend_and_earn?: boolean
  earn_percent_of_subtotal?: number
  max_order_percent_payable_with_bonus?: number
  expiry_enabled?: boolean
  expiry_days_inactivity?: number | null
  welcome_bonus_amount?: number
  birthday_bonus_amount?: number
  review_bonus_amount?: number
  birthday_bonus_days_before?: number
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const body = await readBody<Body>(event)
  const client = await serverSupabaseServiceRole(event)

  const row = {
    shop_id: access.shopId,
    bonuses_enabled: body?.bonuses_enabled !== false,
    allow_simultaneous_bonus_spend_and_earn: body?.allow_simultaneous_bonus_spend_and_earn === true,
    earn_percent_of_subtotal: Math.min(
      100,
      Math.max(0, Math.floor(Number(body?.earn_percent_of_subtotal ?? 5))),
    ),
    max_order_percent_payable_with_bonus: Math.min(
      100,
      Math.max(0, Math.floor(Number(body?.max_order_percent_payable_with_bonus ?? 25))),
    ),
    expiry_enabled: !!body?.expiry_enabled,
    expiry_days_inactivity:
      body?.expiry_days_inactivity == null ? null : Math.max(1, Math.floor(Number(body.expiry_days_inactivity))),
    welcome_bonus_amount: Math.max(0, Math.floor(Number(body?.welcome_bonus_amount ?? 0))),
    birthday_bonus_amount: Math.max(0, Math.floor(Number(body?.birthday_bonus_amount ?? 0))),
    review_bonus_amount: Math.max(0, Math.floor(Number(body?.review_bonus_amount ?? 0))),
    birthday_bonus_days_before: Math.min(
      60,
      Math.max(0, Math.floor(Number(body?.birthday_bonus_days_before ?? 7))),
    ),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await client
    .from('shop_loyalty_settings')
    .upsert(row, { onConflict: 'shop_id' })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('loyalty-settings put:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save loyalty settings' })
  }

  return { ok: true, settings: data }
})
