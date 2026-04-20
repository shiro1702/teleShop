import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

function normalizeCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  const customerProfileId = await resolveCustomerProfileId(event, shop.telegram_bot_token)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('customer_delivery_addresses')
    .select('id,address_line,flat,comment,lat,lon,last_used_at')
    .eq('shop_id', shopId)
    .eq('customer_profile_id', customerProfileId)
    .order('last_used_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('customer addresses get:', error)
    return { ok: true, items: [] }
  }

  return {
    ok: true,
    items: (data || []).map((row: any) => ({
      id: String(row.id),
      address: String(row.address_line || ''),
      flat: row.flat ? String(row.flat) : '',
      comment: row.comment ? String(row.comment) : '',
      lat: normalizeCoord(row.lat),
      lon: normalizeCoord(row.lon),
    })),
  }
})
