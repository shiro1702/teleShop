import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'
import {
  createServiceCallEvent,
  getServiceCallLabel,
  sendMax,
  sendTelegram,
  type ServiceCallType,
} from '~/server/utils/serviceCalls'
import { isHallOrderFulfillmentType } from '~/utils/fulfillmentPreference'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'
import {
  getMaxBotTokenForShop,
  getMessengerInitDataFromEvent,
  uniqueNonEmptyTokens,
  validateWebAppInitDataAnyToken,
} from '~/server/utils/messengerInitData'

type Body = {
  orderId?: string
  restaurantId?: string
  callType?: ServiceCallType
  idempotencyKey?: string | null
  tableNumber?: string | null
  tableSlug?: string | null
}

function isAllowedCallType(value: string): value is ServiceCallType {
  return value === 'call_waiter' || value === 'call_hookah' || value === 'request_bill'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  let orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const restaurantIdFromBody = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : ''
  const callTypeRaw = typeof body.callType === 'string' ? body.callType.trim() : ''
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim().slice(0, 120)
    : null
  const tableNumberRaw = typeof body.tableNumber === 'string' && body.tableNumber.trim()
    ? body.tableNumber.trim().slice(0, 64)
    : ''
  const tableSlugRaw = typeof body.tableSlug === 'string' && body.tableSlug.trim()
    ? body.tableSlug.trim().slice(0, 120)
    : ''

  if (!isAllowedCallType(callTypeRaw)) throw createError({ statusCode: 400, statusMessage: 'Invalid callType' })

  const config = useRuntimeConfig(event)
  const tenant = event.context?.tenant as { telegramBotToken?: string } | undefined
  const botToken =
    typeof tenant?.telegramBotToken === 'string' && tenant.telegramBotToken.trim()
      ? tenant.telegramBotToken.trim()
      : String(config.botToken || '')
  if (!botToken) throw createError({ statusCode: 500, statusMessage: 'Bot token missing' })

  const client = await serverSupabaseServiceRole(event)
  const profileId = await resolveCustomerProfileId(event, botToken).catch(() => '')
  const initData = getMessengerInitDataFromEvent(event)
  const telegramCandidateTokens = uniqueNonEmptyTokens([
    typeof tenant?.telegramBotToken === 'string' ? tenant.telegramBotToken : undefined,
    botToken,
    config.botToken as string | undefined,
  ])
  const telegramUserId = initData
    ? validateWebAppInitDataAnyToken(initData, telegramCandidateTokens)?.id ?? null
    : null
  const tenantIntegrationKeys = (event.context?.tenant as { integrationKeys?: Record<string, unknown> } | undefined)?.integrationKeys
  const maxMiniToken = getMaxBotTokenForShop(tenantIntegrationKeys, {
    maxMiniAppBotToken: config.maxMiniAppBotToken as string | undefined,
    maxApiToken: config.maxApiToken as string | undefined,
  })
  const maxCandidateTokens = uniqueNonEmptyTokens([
    typeof tenantIntegrationKeys?.max_bot_token === 'string' ? tenantIntegrationKeys.max_bot_token : undefined,
    config.maxMiniAppBotToken as string | undefined,
    config.maxApiToken as string | undefined,
    maxMiniToken,
  ])
  const maxUserId = initData
    ? String(validateWebAppInitDataAnyToken(initData, maxCandidateTokens)?.id || '').trim()
    : ''
  let fallbackProfileId = ''
  if (!profileId && maxUserId) {
    const { data: maxProfile } = await client
      .from('profiles')
      .select('id')
      .eq('max_user_id', maxUserId)
      .maybeSingle()
    fallbackProfileId = maxProfile?.id ? String(maxProfile.id) : ''
  }
  const resolvedProfileFilterId = profileId || fallbackProfileId

  let order: any | null = null
  if (orderId) {
    let directOrderQuery = client
      .from('orders')
      .select('id,shop_id,restaurant_id,customer_profile_id,customer_telegram_id,order_number,fulfillment_type')
      .eq('id', orderId)
    if (resolvedProfileFilterId) {
      directOrderQuery = directOrderQuery.eq('customer_profile_id', resolvedProfileFilterId)
    } else if (telegramUserId != null) {
      directOrderQuery = directOrderQuery.eq('customer_telegram_id', telegramUserId)
    } else {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const { data: directOrder } = await directOrderQuery.maybeSingle()
    order = directOrder
  } else if (restaurantIdFromBody && resolvedProfileFilterId) {
    const { data: fallbackOrder } = await client
      .from('orders')
      .select('id,shop_id,restaurant_id,customer_profile_id,customer_telegram_id,order_number,fulfillment_type')
      .eq('customer_profile_id', resolvedProfileFilterId)
      .eq('restaurant_id', restaurantIdFromBody)
      .in('status', ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    order = fallbackOrder
    if (fallbackOrder?.id) orderId = String(fallbackOrder.id)
  } else if (resolvedProfileFilterId) {
    const { data: latestOrder } = await client
      .from('orders')
      .select('id,shop_id,restaurant_id,customer_profile_id,customer_telegram_id,order_number,fulfillment_type')
      .eq('customer_profile_id', resolvedProfileFilterId)
      .in('status', ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    order = latestOrder
    if (latestOrder?.id) orderId = String(latestOrder.id)
  }

  if (order && orderId && !isHallOrderFulfillmentType(String((order as any).fulfillment_type || ''))) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Сервис в зале доступен только для заказов, оформленных в зале',
    })
  }

  let shopId = ''
  let restaurantId = ''
  if (order && (order as any).restaurant_id) {
    shopId = String((order as any).shop_id)
    restaurantId = String((order as any).restaurant_id)
  } else if (restaurantIdFromBody) {
    const xShopId = String(getHeader(event, 'x-shop-id') || '').trim()
    let restaurantQuery = client
      .from('restaurants')
      .select('id,shop_id,name,service_calls_enabled,service_call_types,manager_group_chat_id,manager_max_chat_id')
      .eq('id', restaurantIdFromBody)
      .limit(1)
    if (xShopId) restaurantQuery = restaurantQuery.eq('shop_id', xShopId)
    const { data: fallbackRestaurant } = await restaurantQuery.maybeSingle()
    if (!fallbackRestaurant) {
      throw createError({ statusCode: 404, statusMessage: 'Филиал не найден' })
    }
    shopId = String((fallbackRestaurant as any).shop_id)
    restaurantId = String((fallbackRestaurant as any).id)
  } else {
    throw createError({ statusCode: 404, statusMessage: 'Активный заказ не найден. Сначала оформите заказ.' })
  }

  const customerTelegramIdRaw = Number((order as any)?.customer_telegram_id)
  const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0
    ? customerTelegramIdRaw
    : null

  const { data: profile } = resolvedProfileFilterId
    ? await client
      .from('profiles')
      .select('id,max_user_id,max_conversation_id')
      .eq('id', resolvedProfileFilterId)
      .maybeSingle()
    : { data: null as any }
  const resolvedProfileId = typeof (profile as any)?.id === 'string' ? String((profile as any).id) : null
  const customerMaxUserId = typeof (profile as any)?.max_user_id === 'string' ? String((profile as any).max_user_id).trim() : null
  const customerMaxConversationId = typeof (profile as any)?.max_conversation_id === 'string' ? String((profile as any).max_conversation_id).trim() : null

  const { data: restaurant } = await client
    .from('restaurants')
    .select('name,service_calls_enabled,service_call_types,manager_group_chat_id,manager_max_chat_id')
    .eq('id', restaurantId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (!restaurant) throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })
  if (!(restaurant as any).service_calls_enabled) {
    throw createError({ statusCode: 409, statusMessage: 'Service calls disabled for this branch' })
  }
  const enabledTypesRaw = Array.isArray((restaurant as any).service_call_types)
    ? (restaurant as any).service_call_types
    : ['call_waiter', 'call_hookah', 'request_bill']
  const enabledTypes = enabledTypesRaw.map((x: unknown) => String(x))
  const orgSettings = await getOrganizationSettings(event, shopId)
  const orgButtons = orgSettings.ops.dineInStaffButtons || { waiter: true, hookah: false, requestBill: true }
  const orgEnabledTypes = [
    ...(orgButtons.waiter === false ? [] : ['call_waiter']),
    ...(orgButtons.hookah === true ? ['call_hookah'] : []),
    ...(orgButtons.requestBill === false ? [] : ['request_bill']),
  ]
  const effectiveEnabledTypes = enabledTypes.filter((type: string) => orgEnabledTypes.includes(type))
  if (!effectiveEnabledTypes.includes(callTypeRaw)) {
    throw createError({ statusCode: 409, statusMessage: 'Call type disabled for this branch' })
  }

  let resolvedTableNumber = ''
  if (tableSlugRaw) {
    const { data: tableBySlug } = await client
      .from('restaurant_tables')
      .select('table_number')
      .eq('restaurant_id', restaurantId)
      .eq('qr_slug', tableSlugRaw)
      .eq('is_active', true)
      .maybeSingle()
    resolvedTableNumber = typeof (tableBySlug as any)?.table_number === 'string'
      ? String((tableBySlug as any).table_number).trim().slice(0, 64)
      : ''
  }
  if (!resolvedTableNumber && tableNumberRaw) {
    const { data: tableByNumber } = await client
      .from('restaurant_tables')
      .select('table_number')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumberRaw)
      .eq('is_active', true)
      .maybeSingle()
    resolvedTableNumber = typeof (tableByNumber as any)?.table_number === 'string'
      ? String((tableByNumber as any).table_number).trim().slice(0, 64)
      : ''
  }

  if (!profileId && !resolvedTableNumber) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Для вызова без авторизации отсканируйте QR-код столика.',
    })
  }

  let serviceCallId = ''
  const nowIso = new Date().toISOString()
  if (idempotencyKey && orderId) {
    const { data: existing } = await client
      .from('service_calls')
      .select('id,status,created_at')
      .eq('order_id', orderId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing?.id) {
      return { ok: true, callId: String(existing.id), status: String((existing as any).status || 'created'), deduplicated: true }
    }
  }

  const { data: inserted, error: insertError } = await client
    .from('service_calls')
    .insert({
      shop_id: shopId,
      restaurant_id: restaurantId,
      order_id: orderId || null,
      customer_profile_id: resolvedProfileId,
      customer_telegram_id: customerTelegramId,
      customer_max_user_id: customerMaxUserId || null,
      customer_max_conversation_id: customerMaxConversationId || null,
      table_number: resolvedTableNumber || null,
      call_type: callTypeRaw,
      status: 'created',
      source_channel: getHeader(event, 'x-messenger-init-data') ? 'chat' : 'web',
      idempotency_key: idempotencyKey,
      updated_at: nowIso,
    })
    .select('id')
    .maybeSingle()
  if (insertError || !inserted?.id) {
    console.error('service_calls insert failed:', insertError)
    throw createError({
      statusCode: 500,
      statusMessage: insertError?.message || 'Failed to create service call',
    })
  }
  serviceCallId = String(inserted.id)

  await createServiceCallEvent(event, {
    serviceCallId,
    shopId,
    restaurantId,
    orderId: orderId || null,
    eventType: 'created',
    eventStatus: 'created',
    channel: 'system',
    message: `Клиент отправил запрос: ${getServiceCallLabel(callTypeRaw)}`,
    extraPayload: { callType: callTypeRaw, tableNumber: resolvedTableNumber || null },
  })

  const orderRef = orderId ? String((order as any)?.order_number || orderId).slice(0, 12) : '—'
  const requestText = [
    `🔔 Запрос клиента: ${getServiceCallLabel(callTypeRaw)}`,
    `📦 Заказ #${orderRef}`,
    `🪑 Столик: ${resolvedTableNumber ? `№${resolvedTableNumber}` : 'не указан'}`,
    `🆔 Call ID: ${serviceCallId}`,
    `🏪 Филиал: ${String((restaurant as any).name || '—')}`,
  ].join('\n')

  const callbackButtons = {
    inline_keyboard: [
      [{ text: 'Скоро подойду', callback_data: `svc:soon:${serviceCallId}` }],
      [{ text: 'Уже бегу к вам', callback_data: `svc:on_my_way:${serviceCallId}` }],
      [{ text: 'Запрос выполнен', callback_data: `svc:done:${serviceCallId}` }],
      [{ text: '📱 Связаться с клиентом', callback_data: `svc:contact:${serviceCallId}` }],
    ],
  }

  const managerGroupChatId = typeof (restaurant as any).manager_group_chat_id === 'string'
    ? String((restaurant as any).manager_group_chat_id).trim()
    : ''
  if (managerGroupChatId) {
    await sendTelegram(botToken, 'sendMessage', {
      chat_id: managerGroupChatId,
      text: requestText,
      reply_markup: callbackButtons,
    }).catch((err) => {
      console.error('service call telegram notify failed:', err)
    })
  }

  const managerMaxChatId = typeof (restaurant as any).manager_max_chat_id === 'string'
    ? String((restaurant as any).manager_max_chat_id).trim()
    : ''
  const maxBaseUrl = String((config.maxApiBaseUrl as string) || '').trim()
  const maxToken = String((config.maxApiToken as string) || '').trim()
  if (managerMaxChatId && maxBaseUrl && maxToken) {
    await sendMax(maxBaseUrl, maxToken, {
      conversationId: managerMaxChatId,
      text: `${requestText}\n\nОтветьте командой: /sc <call_id> soon|on_my_way|done\nДля запроса контакта: /contact <call_id>`,
    }).catch((err) => {
      console.error('service call max notify failed:', err)
    })
  }

  const clientText = `Запрос отправлен персоналу: ${getServiceCallLabel(callTypeRaw)}${resolvedTableNumber ? ` (столик №${resolvedTableNumber})` : ''}`
  if (customerTelegramId) {
    await sendTelegram(botToken, 'sendMessage', {
      chat_id: customerTelegramId,
      text: clientText,
    }).catch(() => {})
  }
  if ((customerMaxConversationId || customerMaxUserId) && maxBaseUrl && maxToken) {
    await sendMax(maxBaseUrl, maxToken, {
      conversationId: customerMaxConversationId || undefined,
      userId: customerMaxConversationId ? undefined : customerMaxUserId || undefined,
      text: clientText,
    }).catch(() => {})
  }

  return { ok: true, callId: serviceCallId, status: 'created', tableNumber: resolvedTableNumber || null }
})

