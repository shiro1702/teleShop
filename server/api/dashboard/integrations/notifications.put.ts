import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  channelPolicy?: {
    primary?: 'telegram' | 'max'
    secondary?: 'telegram' | 'max'
    maxEnabled?: boolean
  }
  restaurantSettings?: {
    id: string
    managerNotificationMode?: 'group' | 'personal'
    managerGroupChatId?: string
    managerMaxChatId?: string
    managerRecipients?: Array<{ channel: 'telegram' | 'max'; targetId: string }>
  }
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can update integrations' })
  }

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const client = await serverSupabaseServiceRole(event)

  if (body.channelPolicy) {
    const nextPolicy = {
      primary: body.channelPolicy.primary === 'max' ? 'max' : 'telegram',
      secondary: body.channelPolicy.secondary === 'telegram' ? 'telegram' : 'max',
      maxEnabled: body.channelPolicy.maxEnabled === true,
    }
    await client.from('shops').update({ channel_policy: nextPolicy }).eq('id', access.shopId)
  }

  if (body.restaurantSettings?.id) {
    const recipients = Array.isArray(body.restaurantSettings.managerRecipients)
      ? body.restaurantSettings.managerRecipients
          .filter((item) => (item.channel === 'telegram' || item.channel === 'max') && item.targetId?.trim())
          .map((item) => ({ channel: item.channel, targetId: item.targetId.trim() }))
      : []
    await client
      .from('restaurants')
      .update({
        manager_notification_mode: body.restaurantSettings.managerNotificationMode === 'personal' ? 'personal' : 'group',
        manager_group_chat_id: body.restaurantSettings.managerGroupChatId?.trim() || null,
        manager_max_chat_id: body.restaurantSettings.managerMaxChatId?.trim() || null,
        manager_recipients: recipients,
      })
      .eq('id', body.restaurantSettings.id)
      .eq('shop_id', access.shopId)
  }

  return { ok: true }
})
