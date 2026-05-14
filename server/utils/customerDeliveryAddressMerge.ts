import type { SupabaseClient } from '@supabase/supabase-js'

type ServiceClient = SupabaseClient<any, 'public', any>

type AddressRow = {
  id: string
  shop_id: string
  address_line: string
  flat: string | null
  comment: string | null
  lat: number | null
  lon: number | null
  last_used_at: string
}

function pickNewerIso(a: string, b: string): string {
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  return Number.isFinite(ta) && Number.isFinite(tb) ? (ta >= tb ? a : b) : a
}

/**
 * Переносит строки customer_delivery_addresses с fromProfileId на toProfileId,
 * сливая дубликаты (shop_id + address_line + flat).
 */
export async function migrateCustomerDeliveryAddresses(
  serviceClient: ServiceClient,
  fromProfileId: string,
  toProfileId: string,
): Promise<void> {
  if (!fromProfileId || !toProfileId || fromProfileId === toProfileId) return

  const { data: rows, error } = await serviceClient
    .from('customer_delivery_addresses')
    .select('id,shop_id,address_line,flat,comment,lat,lon,last_used_at')
    .eq('customer_profile_id', fromProfileId)

  if (error || !rows?.length) return

  for (const raw of rows as AddressRow[]) {
    const line = String(raw.address_line || '').trim()
    if (!line) {
      await serviceClient.from('customer_delivery_addresses').delete().eq('id', raw.id)
      continue
    }
    const flatVal = raw.flat != null && String(raw.flat).trim() !== '' ? String(raw.flat).trim() : null

    const base = serviceClient
      .from('customer_delivery_addresses')
      .select('id,comment,lat,lon,last_used_at')
      .eq('customer_profile_id', toProfileId)
      .eq('shop_id', raw.shop_id)
      .eq('address_line', line)

    const { data: clash } = flatVal
      ? await base.eq('flat', flatVal).maybeSingle()
      : await base.is('flat', null).maybeSingle()

    if (clash?.id) {
      const c = clash as { id: string; comment: string | null; lat: number | null; lon: number | null; last_used_at: string }
      const lastUsed = pickNewerIso(String(raw.last_used_at || ''), String(c.last_used_at || ''))
      await serviceClient
        .from('customer_delivery_addresses')
        .update({
          comment: raw.comment || c.comment || null,
          lat: raw.lat ?? c.lat ?? null,
          lon: raw.lon ?? c.lon ?? null,
          last_used_at: lastUsed,
        })
        .eq('id', c.id)
      await serviceClient.from('customer_delivery_addresses').delete().eq('id', raw.id)
    } else {
      await serviceClient
        .from('customer_delivery_addresses')
        .update({ customer_profile_id: toProfileId })
        .eq('id', raw.id)
    }
  }
}
