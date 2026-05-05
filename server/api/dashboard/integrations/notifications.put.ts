import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'

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
    etaButtonsEnabled?: boolean
    etaPresets?: number[]
    etaRateLimitSec?: number
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
    const orgSettings = await getOrganizationSettings(event, access.shopId)
    const orgButtons = orgSettings.ops.dineInStaffButtons || { waiter: true, hookah: false, requestBill: true }
    const orgAllowedTypes = [
      ...(orgButtons.waiter === false ? [] : ['call_waiter']),
      ...(orgButtons.hookah === true ? ['call_hookah'] : []),
      ...(orgButtons.requestBill === false ? [] : ['request_bill']),
    ]
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
          .filter((x) => x === 'call_waiter' || x === 'call_hookah' || x === 'request_bill')
          .filter((x) => orgAllowedTypes.includes(x)),
      ),
    )
    const { data: restaurantExisting } = await client
      .from('restaurants')
      .select('integration_keys')
      .eq('id', body.restaurantSettings.id)
      .eq('shop_id', access.shopId)
      .maybeSingle()
    const currentIntegrationKeys =
      (restaurantExisting as any)?.integration_keys && typeof (restaurantExisting as any).integration_keys === 'object'
        ? ((restaurantExisting as any).integration_keys as Record<string, unknown>)
        : {}
    const rawEtaPresets = Array.isArray(body.restaurantSettings.etaPresets)
      ? body.restaurantSettings.etaPresets
      : (Array.isArray((currentIntegrationKeys as any).eta_presets) ? (currentIntegrationKeys as any).eta_presets : [10, 15, 20, 30, 45])
    const etaPresets = rawEtaPresets
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .map((value: number) => Math.floor(value))
      .slice(0, 8)
    const etaRateLimitRaw = Number(
      body.restaurantSettings.etaRateLimitSec
      ?? (currentIntegrationKeys as any).eta_rate_limit_sec
      ?? 180,
    )
    const etaRateLimitSec = Number.isFinite(etaRateLimitRaw)
      ? Math.min(3600, Math.max(30, Math.floor(etaRateLimitRaw)))
      : 180
    const integrationKeysNext: Record<string, unknown> = {
      ...currentIntegrationKeys,
      // Unified flow is always on; dashboard no longer exposes a toggle.
      unified_order_flow_enabled: true,
      eta_buttons_enabled: body.restaurantSettings.etaButtonsEnabled === true,
      eta_presets: etaPresets.length ? etaPresets : [10, 15, 20, 30, 45],
      eta_rate_limit_sec: etaRateLimitSec,
    }

    await client
      .from('restaurants')
      .update({
        manager_notification_mode: body.restaurantSettings.managerNotificationMode === 'personal' ? 'personal' : 'group',
        manager_group_chat_id: body.restaurantSettings.managerGroupChatId?.trim() || null,
        manager_max_chat_id: body.restaurantSettings.managerMaxChatId?.trim() || null,
        manager_recipients: recipients,
        service_calls_enabled: body.restaurantSettings.serviceCallsEnabled === true,
        service_call_types: serviceCallTypes.length ? serviceCallTypes : ['call_waiter', 'call_hookah', 'request_bill'],
        integration_keys: integrationKeysNext,
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
