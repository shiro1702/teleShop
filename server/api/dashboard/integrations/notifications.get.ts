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
    .select('id,name,manager_notification_mode,manager_group_chat_id,manager_max_chat_id,manager_recipients,service_calls_enabled,service_call_types,integration_keys')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
  if (restaurantId) restaurantsQuery = restaurantsQuery.eq('id', restaurantId)

  const { data: restaurants } = await restaurantsQuery.range(from, to)

  const rows = restaurants ?? []
  const pagedRows = rows.slice(0, pageSize)
  const restaurantIds = pagedRows.map((row: any) => row.id).filter(Boolean)
  let bindingsByRestaurant = new Map<string, Array<Record<string, unknown>>>()
  if (restaurantIds.length) {
    const { data: bindings } = await client
      .from('restaurant_staff_bot_bindings')
      .select('id,restaurant_id,channel,external_user_id,staff_role,display_name,is_active,updated_at')
      .in('restaurant_id', restaurantIds)
      .order('updated_at', { ascending: false })
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const row of bindings || []) {
      const restaurantIdValue = String((row as any).restaurant_id || '')
      if (!restaurantIdValue) continue
      const current = grouped.get(restaurantIdValue) || []
      current.push({
        id: String((row as any).id),
        channel: String((row as any).channel),
        externalUserId: String((row as any).external_user_id || ''),
        staffRole: String((row as any).staff_role || ''),
        displayName: typeof (row as any).display_name === 'string' ? String((row as any).display_name) : '',
        isActive: Boolean((row as any).is_active),
      })
      grouped.set(restaurantIdValue, current)
    }
    bindingsByRestaurant = grouped
  }

  return {
    ok: true,
    channelPolicy: (shop as any)?.channel_policy ?? { primary: 'telegram', secondary: 'max', maxEnabled: false },
    restaurants: pagedRows.map((row: any) => {
      const integrationKeys = row?.integration_keys && typeof row.integration_keys === 'object' ? row.integration_keys : {}
      const rawEtaPresets = Array.isArray((integrationKeys as any).eta_presets) ? (integrationKeys as any).eta_presets : []
      const etaPresets = rawEtaPresets
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .slice(0, 8)
      return {
      id: row.id,
      name: row.name,
      managerNotificationMode: row.manager_notification_mode || 'group',
      managerGroupChatId: row.manager_group_chat_id || '',
      managerMaxChatId: row.manager_max_chat_id || '',
      managerRecipients: Array.isArray(row.manager_recipients) ? row.manager_recipients : [],
      serviceCallsEnabled: row.service_calls_enabled === true,
      serviceCallTypes: Array.isArray(row.service_call_types) ? row.service_call_types : ['call_waiter', 'call_hookah', 'request_bill'],
      staffBotBindings: bindingsByRestaurant.get(String(row.id)) || [],
      unifiedOrderFlowEnabled: true,
      etaButtonsEnabled: Boolean((integrationKeys as any).eta_buttons_enabled),
      etaPresets: etaPresets.length ? etaPresets : [10, 15, 20, 30, 45],
      etaRateLimitSec: (() => {
        const raw = Number((integrationKeys as any).eta_rate_limit_sec)
        if (!Number.isFinite(raw) || raw < 30) return 180
        return Math.min(3600, Math.floor(raw))
      })(),
    }
    }),
    pagination: {
      page,
      pageSize,
      hasNext: rows.length > pageSize,
      hasPrev: page > 1,
    },
  }
})
