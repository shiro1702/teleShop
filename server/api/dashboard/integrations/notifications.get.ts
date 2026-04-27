import { defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const query = getQuery(event)
  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 25, 1), 100)
  const restaurantId = typeof query.restaurantId === 'string' ? query.restaurantId.trim() : ''
  const from = (page - 1) * pageSize
  const to = from + pageSize
  const client = await serverSupabaseServiceRole(event)

  const { data: shop } = await client
    .from('shops')
    .select('channel_policy')
    .eq('id', access.shopId)
    .maybeSingle()

  let restaurantsQuery = client
    .from('restaurants')
    .select('id,name,manager_notification_mode,manager_group_chat_id,manager_max_chat_id,manager_recipients')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
  if (restaurantId) restaurantsQuery = restaurantsQuery.eq('id', restaurantId)

  const { data: restaurants } = await restaurantsQuery.range(from, to)

  const rows = restaurants ?? []
  const pagedRows = rows.slice(0, pageSize)

  return {
    ok: true,
    channelPolicy: (shop as any)?.channel_policy ?? { primary: 'telegram', secondary: 'max', maxEnabled: false },
    restaurants: pagedRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      managerNotificationMode: row.manager_notification_mode || 'group',
      managerGroupChatId: row.manager_group_chat_id || '',
      managerMaxChatId: row.manager_max_chat_id || '',
      managerRecipients: Array.isArray(row.manager_recipients) ? row.manager_recipients : [],
    })),
    pagination: {
      page,
      pageSize,
      hasNext: rows.length > pageSize,
      hasPrev: page > 1,
    },
  }
})
