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
    serviceCallsEnabled?: boolean
    serviceCallTypes?: Array<'call_waiter' | 'call_hookah' | 'request_bill'>
  }
  staffBindingUpsert?: {
    restaurantId: string
    id?: string
    channel: 'telegram' | 'max'
    externalUserId: string
    staffRole: 'waiter' | 'hookah' | 'cashier' | 'manager'
    displayName?: string
    isActive?: boolean
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
    const serviceCallTypesRaw = Array.isArray(body.restaurantSettings.serviceCallTypes)
      ? body.restaurantSettings.serviceCallTypes
      : ['call_waiter', 'call_hookah', 'request_bill']
    const serviceCallTypes = Array.from(
      new Set(
        serviceCallTypesRaw
          .map((x) => String(x))
          .filter((x) => x === 'call_waiter' || x === 'call_hookah' || x === 'request_bill'),
      ),
    )
    await client
      .from('restaurants')
      .update({
        manager_notification_mode: body.restaurantSettings.managerNotificationMode === 'personal' ? 'personal' : 'group',
        manager_group_chat_id: body.restaurantSettings.managerGroupChatId?.trim() || null,
        manager_max_chat_id: body.restaurantSettings.managerMaxChatId?.trim() || null,
        manager_recipients: recipients,
        service_calls_enabled: body.restaurantSettings.serviceCallsEnabled === true,
        service_call_types: serviceCallTypes.length ? serviceCallTypes : ['call_waiter', 'call_hookah', 'request_bill'],
      })
      .eq('id', body.restaurantSettings.id)
      .eq('shop_id', access.shopId)
  }

  if (body.staffBindingUpsert?.restaurantId) {
    const patch = body.staffBindingUpsert
    const restaurantId = patch.restaurantId.trim()
    const channel = patch.channel === 'max' ? 'max' : 'telegram'
    const staffRole = patch.staffRole
    if (!restaurantId) throw createError({ statusCode: 400, statusMessage: 'restaurantId is required for staff binding' })
    if (!(staffRole === 'waiter' || staffRole === 'hookah' || staffRole === 'cashier' || staffRole === 'manager')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid staffRole for staff binding' })
    }
    const externalUserId = String(patch.externalUserId || '').trim()
    if (!externalUserId) throw createError({ statusCode: 400, statusMessage: 'externalUserId is required' })

    const row = {
      shop_id: access.shopId,
      restaurant_id: restaurantId,
      channel,
      external_user_id: externalUserId,
      staff_role: staffRole,
      display_name: patch.displayName?.trim() || null,
      is_active: patch.isActive !== false,
      updated_at: new Date().toISOString(),
    }
    if (typeof patch.id === 'string' && patch.id.trim()) {
      await client
        .from('restaurant_staff_bot_bindings')
        .update(row)
        .eq('id', patch.id.trim())
        .eq('shop_id', access.shopId)
      return { ok: true }
    }
    await client
      .from('restaurant_staff_bot_bindings')
      .upsert(row, { onConflict: 'restaurant_id,channel,external_user_id' })
  }

  return { ok: true }
})
