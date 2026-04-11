import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event) => {
  const { shopId, shop } = await requireTenantShop(event)
  const customerProfileId = await resolveCustomerProfileId(event, shop.telegram_bot_token)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody<{
    addressLine?: string | null
    flat?: string | null
    comment?: string | null
  }>(event).catch(() => ({}))

  const addressLine = typeof body?.addressLine === 'string' ? body.addressLine.trim() : ''
  const flat = typeof body?.flat === 'string' ? body.flat.trim() : ''
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  if (!addressLine) {
    throw createError({ statusCode: 400, statusMessage: 'addressLine is required' })
  }

  const baseExistingQuery = client
    .from('customer_delivery_addresses')
    .select('id')
    .eq('shop_id', shopId)
    .eq('customer_profile_id', customerProfileId)
    .eq('address_line', addressLine)

  const { data: existing } = flat
    ? await baseExistingQuery.eq('flat', flat).maybeSingle()
    : await baseExistingQuery.is('flat', null).maybeSingle()

  if (existing?.id) {
    await client
      .from('customer_delivery_addresses')
      .update({
        comment: comment || null,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('shop_id', shopId)
  } else {
    await client.from('customer_delivery_addresses').insert({
      shop_id: shopId,
      customer_profile_id: customerProfileId,
      address_line: addressLine,
      flat: flat || null,
      comment: comment || null,
      last_used_at: new Date().toISOString(),
    })
  }

  const { data: list } = await client
    .from('customer_delivery_addresses')
    .select('id')
    .eq('shop_id', shopId)
    .eq('customer_profile_id', customerProfileId)
    .order('last_used_at', { ascending: false })

  const ids = (list || []).map((x: any) => String(x.id))
  if (ids.length > 5) {
    const toDelete = ids.slice(5)
    await client
      .from('customer_delivery_addresses')
      .delete()
      .eq('shop_id', shopId)
      .eq('customer_profile_id', customerProfileId)
      .in('id', toDelete)
  }

  return { ok: true }
})
