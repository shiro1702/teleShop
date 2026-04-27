import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type Payload = {
  shopId?: string
  externalEventId?: string
  externalOrderId?: string
  externalStatus?: string
  iikoTerminalGroupId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Payload>(event).catch(() => ({} as Payload))
  const shopId = typeof body.shopId === 'string' ? body.shopId.trim() : ''
  const externalEventId = typeof body.externalEventId === 'string' ? body.externalEventId.trim() : ''
  const externalOrderId = typeof body.externalOrderId === 'string' ? body.externalOrderId.trim() : ''
  const externalStatus = typeof body.externalStatus === 'string' ? body.externalStatus.trim() : ''
  const iikoTerminalGroupId = typeof body.iikoTerminalGroupId === 'string' ? body.iikoTerminalGroupId.trim() : ''
  if (!shopId || !externalEventId || !externalOrderId || !externalStatus) {
    throw createError({ statusCode: 400, statusMessage: 'shopId, externalEventId, externalOrderId and externalStatus are required' })
  }
  const db = await serverSupabaseServiceRole(event)

  let restaurantId: string | null = null
  if (iikoTerminalGroupId) {
    const { data: map } = await db
      .from('iiko_restaurant_mapping')
      .select('restaurant_id')
      .eq('shop_id', shopId)
      .eq('iiko_terminal_group_id', iikoTerminalGroupId)
      .maybeSingle()
    restaurantId = map?.restaurant_id ?? null
  }

  const signature = getHeader(event, 'x-iiko-signature') || ''
  const eventInsert = await db.from('iiko_events').insert({
    shop_id: shopId,
    restaurant_id: restaurantId,
    event_type: 'order_status',
    external_event_id: externalEventId,
    payload: body ?? {},
    signature,
  })
  if (eventInsert.error?.code === '23505') return { ok: true, duplicate: true }
  if (eventInsert.error) throw createError({ statusCode: 500, statusMessage: 'Failed to persist iiko event' })

  const { error: orderError } = await db
    .from('orders')
    .update({
      external_status: externalStatus,
      last_sync_error: null,
    })
    .eq('shop_id', shopId)
    .eq('external_order_id', externalOrderId)
  if (orderError) throw createError({ statusCode: 500, statusMessage: 'Failed to update order status' })

  await db.from('iiko_events').update({ processed_at: new Date().toISOString() }).eq('shop_id', shopId).eq('external_event_id', externalEventId)
  return { ok: true }
})
