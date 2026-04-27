import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type Payload = {
  shopId?: string
  externalEventId?: string
  eventType?: string
  iikoTerminalGroupId?: string
  items?: Array<{ externalProductId?: string; inStopList?: boolean }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Payload>(event).catch(() => ({} as Payload))
  const shopId = typeof body.shopId === 'string' ? body.shopId.trim() : ''
  const externalEventId = typeof body.externalEventId === 'string' ? body.externalEventId.trim() : ''
  const iikoTerminalGroupId = typeof body.iikoTerminalGroupId === 'string' ? body.iikoTerminalGroupId.trim() : ''
  if (!shopId || !externalEventId || !iikoTerminalGroupId) {
    throw createError({ statusCode: 400, statusMessage: 'shopId, externalEventId and iikoTerminalGroupId are required' })
  }
  const db = await serverSupabaseServiceRole(event)
  const { data: map } = await db
    .from('iiko_restaurant_mapping')
    .select('restaurant_id')
    .eq('shop_id', shopId)
    .eq('iiko_terminal_group_id', iikoTerminalGroupId)
    .maybeSingle()
  if (!map?.restaurant_id) throw createError({ statusCode: 404, statusMessage: 'Restaurant mapping not found' })

  const signature = getHeader(event, 'x-iiko-signature') || ''
  const eventInsert = await db.from('iiko_events').insert({
    shop_id: shopId,
    restaurant_id: map.restaurant_id,
    event_type: body.eventType || 'menu_availability',
    external_event_id: externalEventId,
    payload: body ?? {},
    signature,
  })
  if (eventInsert.error?.code === '23505') return { ok: true, duplicate: true }
  if (eventInsert.error) throw createError({ statusCode: 500, statusMessage: 'Failed to persist iiko event' })

  const items = Array.isArray(body.items) ? body.items : []
  for (const row of items) {
    const externalId = typeof row.externalProductId === 'string' ? row.externalProductId.trim() : ''
    if (!externalId) continue
    const { data: product } = await db.from('products').select('id').eq('shop_id', shopId).eq('external_id', externalId).maybeSingle()
    if (!product?.id) continue
    await db.from('restaurant_product_overrides').upsert({
      shop_id: shopId,
      restaurant_id: map.restaurant_id,
      product_id: product.id,
      is_in_stop_list: row.inStopList === true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,product_id' })
  }
  await db.from('iiko_events').update({ processed_at: new Date().toISOString() }).eq('shop_id', shopId).eq('external_event_id', externalEventId)
  return { ok: true }
})
