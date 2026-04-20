import { defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const channel = typeof query.channel === 'string' ? query.channel.trim() : ''
  const restaurantId = typeof query.restaurantId === 'string' ? query.restaurantId.trim() : ''

  const client = await serverSupabaseServiceRole(event)
  let db = client
    .from('notification_events')
    .select('id,notification_key,event_type,channel,shop_id,restaurant_id,city_id,conversation_id,delivery_status,attempt_count,last_error,created_at,updated_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) db = db.eq('delivery_status', status)
  if (channel) db = db.eq('channel', channel)
  if (restaurantId) db = db.eq('restaurant_id', restaurantId)

  const { data } = await db
  return { ok: true, items: data ?? [] }
})
