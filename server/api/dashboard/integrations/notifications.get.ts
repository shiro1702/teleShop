import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: shop } = await client
    .from('shops')
    .select('channel_policy')
    .eq('id', access.shopId)
    .maybeSingle()

  const { data: restaurants } = await client
    .from('restaurants')
    .select('id,name,manager_notification_mode,manager_group_chat_id,manager_max_chat_id,manager_recipients')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })

  return {
    ok: true,
    channelPolicy: (shop as any)?.channel_policy ?? { primary: 'telegram', secondary: 'max', maxEnabled: false },
    restaurants: (restaurants ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      managerNotificationMode: row.manager_notification_mode || 'group',
      managerGroupChatId: row.manager_group_chat_id || '',
      managerMaxChatId: row.manager_max_chat_id || '',
      managerRecipients: Array.isArray(row.manager_recipients) ? row.manager_recipients : [],
    })),
  }
})
