// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — типы Node могут быть не подключены в проекте
import crypto from 'node:crypto'
import type { DeliveryZoneProperties } from '../../utils/deliveryZones'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import {
  assertShopIdMatchesTenant,
  requireRestaurantForShop,
  requireRestaurantZoneForShop,
  requireTenantShop,
  type TenantRestaurant,
  type TenantRestaurantZone,
} from '~/server/utils/tenant'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'
import type { CartItemPayload } from '~/server/utils/orderLinePricing'
import { loadTenantProductsForOrder, sumCartLines } from '~/server/utils/orderLinePricing'
import {
  applyPromoToCart,
  capBonusSpend,
  fetchShopLoyaltySettings,
  getCustomerBalance,
} from '~/server/utils/pricingPromoBonus'
import { evaluateMenuAvailability, normalizeTimeWindows } from '~/server/utils/menuAvailability'
import { isOpenNowBySchedule, normalizeWeeklyWorkingHours, resolveEffectiveWorkingHours } from '~/utils/workingHours'
import { dispatchNotificationEvent } from '~/server/utils/notifications'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== hash) return null

  const userStr = params.get('user')
  if (!userStr) return null
  try {
    return JSON.parse(decodeURIComponent(userStr)) as TelegramUser
  } catch {
    return null
  }
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

type PaymentMethod = 'cash' | 'card_courier' | 'online'
type FulfillmentType = 'delivery' | 'pickup' | 'qr-menu'
type PickupPoint = {
  id: string
  name: string
  address: string
}

function parseAvailableFulfillmentTypes(raw: string | undefined): FulfillmentType[] {
  if (!raw) return ['delivery', 'pickup', 'qr-menu']
  const parsed = raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter((x): x is FulfillmentType => x === 'delivery' || x === 'pickup' || x === 'qr-menu')

  if (!parsed.length) return ['delivery', 'pickup', 'qr-menu']
  return Array.from(new Set(parsed))
}

function formatPaymentMethod(method: PaymentMethod | undefined): string {
  if (method === 'card_courier') return 'Картой курьеру'
  if (method === 'online') return 'Онлайн (на сайте)'
  return 'Наличными курьеру'
}

type PromoBreakdown = {
  discountAmount: number
  bonusSpent: number
  subtotalAfterPromo: number
}

function buildOrderMessage(
  orderRef: string,
  items: CartItemPayload[],
  total: number,
  deliveryCost: number,
  deliveryZone: DeliveryZoneProperties | null,
  user: TelegramUser,
  options: {
    fulfillmentType?: FulfillmentType
    pickupPoint?: PickupPoint | null
    addressLine?: string | null
    flat?: string | null
    comment?: string | null
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
    promo?: PromoBreakdown | null
  },
): string {
  const username = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`
  const payableGoods =
    options.promo != null
      ? Math.max(0, options.promo.subtotalAfterPromo - options.promo.bonusSpent)
      : total
  const grandTotal = payableGoods + deliveryCost
  const isPickup = options.fulfillmentType === 'pickup'
  const isQrMenu = options.fulfillmentType === 'qr-menu'
  
  const formattedItems = items.flatMap((item) => {
    const lines = [`  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`]
    
    if (item.selectedParameters && item.selectedParameters.length > 0) {
      item.selectedParameters.forEach(param => {
        const attrs = []
        if (param.weightG) attrs.push(`${param.weightG} г`)
        if (param.volumeMl) attrs.push(`${param.volumeMl} мл`)
        if (param.pieces) attrs.push(`${param.pieces} шт`)
        const attrStr = attrs.length > 0 ? ` (${attrs.join(', ')})` : ''
        lines.push(`    - Вариант: ${param.optionName}${attrStr}`)
      })
    }

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach(mod => {
        if (mod.pricingType === 'multiplier') {
          lines.push(`    - ${mod.optionName} (×${mod.priceMultiplier ?? 1})`)
        } else {
          lines.push(`    - ${mod.optionName}${mod.priceDelta > 0 ? ` (+${formatPrice(mod.priceDelta)})` : mod.priceDelta < 0 ? ` (${formatPrice(mod.priceDelta)})` : ''}`)
        }
      })
    }
    return lines
  })

  const extraPromo: string[] = []
  if (options.promo && options.promo.discountAmount > 0) {
    extraPromo.push(`🎁 Скидка по промокоду: −${formatPrice(options.promo.discountAmount)}`)
  }
  if (options.promo && options.promo.bonusSpent > 0) {
    extraPromo.push(`⭐ Списано бонусами: −${formatPrice(options.promo.bonusSpent)}`)
  }

  const lines: string[] = [
    `📦 Заказ #${orderRef}`,
    '',
    'Состав:',
    ...formattedItems,
    '',
    ...extraPromo,
    ...(extraPromo.length ? [''] : []),
    `💰 Товары к оплате: ${formatPrice(payableGoods)}`,
    isPickup
      ? '🏬 Способ получения: Самовывоз'
      : isQrMenu
        ? '🧾 Способ получения: QR-меню'
        : `🚚 Доставка: ${formatPrice(deliveryCost)}${deliveryZone?.name ? ` (зона: ${deliveryZone.name})` : ''}`,
    isPickup || isQrMenu
      ? `💳 Итого: ${formatPrice(grandTotal)}`
      : `💳 Итого с доставкой: ${formatPrice(grandTotal)}`,
    '',
  ]

  if (!isPickup && !isQrMenu && options.addressLine) {
    const addrParts = [options.addressLine]
    if (options.flat) addrParts.push(options.flat)
    lines.push(`📍 Адрес: ${addrParts.join(', ')}`)
  } else if ((isPickup || isQrMenu) && isPickup && options.pickupPoint) {
    lines.push(`🏬 Точка самовывоза: ${options.pickupPoint.name}, ${options.pickupPoint.address}`)
  }
  if (options.comment) {
    lines.push(`📝 Комментарий: ${options.comment}`)
  }

  lines.push(`💳 Оплата: ${formatPaymentMethod(options.paymentMethod)}`)
  if (options.paymentMethod === 'cash' && typeof options.changeFrom === 'number' && options.changeFrom > 0) {
    lines.push(`💵 Сдача с: ${formatPrice(options.changeFrom)}`)
  }

  lines.push(
    '',
    `👤 Клиент: ${username}`,
    `🆔 Telegram ID: ${user.id}`,
  )
  return lines.join('\n')
}

function buildClientOrderMessage(
  orderRef: string,
  items: CartItemPayload[],
  total: number,
  deliveryCost: number,
  deliveryZone: DeliveryZoneProperties | null,
  options: {
    fulfillmentType?: FulfillmentType
    pickupPoint?: PickupPoint | null
    addressLine?: string | null
    flat?: string | null
    comment?: string | null
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
    promo?: PromoBreakdown | null
  },
): string {
  const payableGoods =
    options.promo != null
      ? Math.max(0, options.promo.subtotalAfterPromo - options.promo.bonusSpent)
      : total
  const grandTotal = payableGoods + deliveryCost
  const isPickup = options.fulfillmentType === 'pickup'
  const isQrMenu = options.fulfillmentType === 'qr-menu'
  
  const formattedItems = items.flatMap((item) => {
    const lines = [`  • ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`]
    
    if (item.selectedParameters && item.selectedParameters.length > 0) {
      item.selectedParameters.forEach(param => {
        const attrs = []
        if (param.weightG) attrs.push(`${param.weightG} г`)
        if (param.volumeMl) attrs.push(`${param.volumeMl} мл`)
        if (param.pieces) attrs.push(`${param.pieces} шт`)
        const attrStr = attrs.length > 0 ? ` (${attrs.join(', ')})` : ''
        lines.push(`    - Вариант: ${param.optionName}${attrStr}`)
      })
    }

    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach(mod => {
        if (mod.pricingType === 'multiplier') {
          lines.push(`    - ${mod.optionName} (×${mod.priceMultiplier ?? 1})`)
        } else {
          lines.push(`    - ${mod.optionName}${mod.priceDelta > 0 ? ` (+${formatPrice(mod.priceDelta)})` : mod.priceDelta < 0 ? ` (${formatPrice(mod.priceDelta)})` : ''}`)
        }
      })
    }
    return lines
  })

  const extraPromo: string[] = []
  if (options.promo && options.promo.discountAmount > 0) {
    extraPromo.push(`🎁 Скидка по промокоду: −${formatPrice(options.promo.discountAmount)}`)
  }
  if (options.promo && options.promo.bonusSpent > 0) {
    extraPromo.push(`⭐ Списано бонусами: −${formatPrice(options.promo.bonusSpent)}`)
  }

  const lines: string[] = [
    `🧾 Ваш заказ #${orderRef} принят!`,
    '',
    'Состав заказа:',
    ...formattedItems,
    '',
    ...extraPromo,
    ...(extraPromo.length ? [''] : []),
    `💰 Товары к оплате: ${formatPrice(payableGoods)}`,
    isPickup
      ? '🏬 Способ получения: Самовывоз'
      : isQrMenu
        ? '🧾 Способ получения: QR-меню'
        : `🚚 Доставка: ${formatPrice(deliveryCost)}${deliveryZone?.name ? ` (зона: ${deliveryZone.name})` : ''}`,
    isPickup || isQrMenu
      ? `💳 Итого: ${formatPrice(grandTotal)}`
      : `💳 Итого с доставкой: ${formatPrice(grandTotal)}`,
  ]

  if (!isPickup && !isQrMenu && options.addressLine) {
    const addrParts = [options.addressLine]
    if (options.flat) addrParts.push(options.flat)
    lines.push(`📍 Адрес: ${addrParts.join(', ')}`)
  } else if ((isPickup || isQrMenu) && isPickup && options.pickupPoint) {
    lines.push(`🏬 Точка самовывоза: ${options.pickupPoint.name}, ${options.pickupPoint.address}`)
  }
  if (options.comment) {
    lines.push(`📝 Комментарий: ${options.comment}`)
  }

  lines.push(`💳 Способ оплаты: ${formatPaymentMethod(options.paymentMethod)}`)
  if (options.paymentMethod === 'cash' && typeof options.changeFrom === 'number' && options.changeFrom > 0) {
    lines.push(`💵 Вы указали сдачу с: ${formatPrice(options.changeFrom)}`)
  }

  lines.push(
    '',
    'Мы будем присылать сюда обновления статуса: приготовление, передача курьеру и доставка 🚚🍣🍱',
  )
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { shopId: tenantShopId, shop: tenantShop } = await requireTenantShop(event)
  const tenantIntegrationKeys = tenantShop.integration_keys ?? {}
  const tenant = event.context.tenant
  const botToken = tenant?.telegramBotToken || (config.botToken as string)
  const tenantFulfillmentRaw = typeof tenantIntegrationKeys.fulfillment_types === 'string'
    ? tenantIntegrationKeys.fulfillment_types
    : (config.public?.fulfillmentTypes as string | undefined)
  const tenantFulfillment = typeof tenantFulfillmentRaw === 'string' && tenantFulfillmentRaw.trim().length
    ? tenantFulfillmentRaw
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .concat(['qr-menu'].filter(() => !tenantFulfillmentRaw.toLowerCase().includes('qr-menu')))
        .join(',')
    : undefined
  const availableFulfillmentTypes = parseAvailableFulfillmentTypes(tenantFulfillment)
  const globallyAllowed = await applyGlobalFulfillmentPolicy(event, tenantShopId, availableFulfillmentTypes)

  if (!botToken) {
    throw createError({ statusCode: 500, message: 'Server config: bot token missing' })
  }

  const body = await readBody<{
    shopId?: string
    shop_id?: string
    restaurantId?: string | null
    items: CartItemPayload[]
    initData?: string | null
    address?: {
      line?: string | null
      flat?: string | null
      comment?: string | null
      zone?: DeliveryZoneProperties | null
    } | null
    pickupPoint?: {
      id?: string | null
      name?: string | null
      address?: string | null
    } | null
    fulfillmentType?: FulfillmentType
    paymentMethod?: PaymentMethod
    changeFrom?: number | null
    promoCode?: string | null
    bonusPointsToSpend?: number | null
  } | null>(event)
  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected { items }' })
  }

  await assertShopIdMatchesTenant(
    event,
    typeof body.shopId === 'string'
      ? body.shopId
      : typeof body.shop_id === 'string'
        ? body.shop_id
        : null,
    tenantShopId,
  )

  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : ''
  const restaurant: TenantRestaurant = await requireRestaurantForShop(event, tenantShopId, restaurantId)
  const orgSettings = await getOrganizationSettings(event, tenantShopId)
  const branchWorkingHours = normalizeWeeklyWorkingHours(restaurant.working_hours, orgSettings.ops.workingHours)
  const effectiveWorkingHours = resolveEffectiveWorkingHours(orgSettings.ops.workingHours, {
    useOrganizationHours: restaurant.use_organization_working_hours !== false,
    workingHours: branchWorkingHours,
  })
  const openStatus = isOpenNowBySchedule(effectiveWorkingHours, orgSettings.locale.timezone)
  if (!openStatus.isOpen) {
    throw createError({
      statusCode: 409,
      message: `Restaurant is closed now (${openStatus.nowHHMM}, ${orgSettings.locale.timezone})`,
    })
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  let user: TelegramUser | null = null
  let customerProfileId: string | null = null
  if (body.initData && typeof body.initData === 'string') {
    user = validateInitData(body.initData, botToken)
    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid initData' })
    }
    const { data: tmaProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('telegram_id', user.id)
      .maybeSingle()
    customerProfileId = tmaProfile?.id ? String(tmaProfile.id) : null
  } else {
    const supabaseUser = await serverSupabaseUser(event)
    if (!supabaseUser) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    const rawUser = supabaseUser as any
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null
    if (!userId) {
      console.error('Supabase user has invalid id/sub in order (WEB):', supabaseUser)
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    customerProfileId = userId
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('telegram_id')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) {
      console.error('Error querying profile for order (WEB):', profileError)
      throw createError({ statusCode: 500, message: 'Failed to read profile' })
    }
    if (!profile || profile.telegram_id == null) {
      throw createError({ statusCode: 409, message: 'Telegram not linked' })
    }
    user = { id: profile.telegram_id as number }
  }

  const uniqueProductIds = Array.from(new Set(body.items.map((item) => item.id)))
  const productMap = await loadTenantProductsForOrder(serviceClient, tenantShopId, uniqueProductIds)

  const promoResult = await applyPromoToCart(
    serviceClient,
    tenantShopId,
    body.items,
    productMap,
    body.promoCode,
    customerProfileId,
  )
  if (!promoResult.ok) {
    throw createError({
      statusCode: 400,
      message: promoResult.errorMessage || 'Промокод не применён',
    })
  }

  let itemsWithServerPrice: CartItemPayload[] = promoResult.pricedLines
  const discountAmount = promoResult.discountAmount
  const promoRow = promoResult.promoRow
  const promoSnapshot = promoResult.promoSnapshot as { subtotalAfterPromo?: number }

  let subtotalAfterPromo =
    typeof promoSnapshot.subtotalAfterPromo === 'number'
      ? promoSnapshot.subtotalAfterPromo
      : sumCartLines(itemsWithServerPrice)

  const loyaltySettings = await fetchShopLoyaltySettings(serviceClient, tenantShopId)
  const requestedBonus =
    typeof body.bonusPointsToSpend === 'number' && Number.isFinite(body.bonusPointsToSpend)
      ? Math.max(0, Math.floor(body.bonusPointsToSpend))
      : 0

  if (requestedBonus > 0 && !customerProfileId) {
    throw createError({ statusCode: 400, message: 'Списание бонусов доступно только авторизованным пользователям' })
  }
  if (requestedBonus > 0 && !loyaltySettings.bonuses_enabled) {
    throw createError({ statusCode: 400, message: 'Списание бонусов временно отключено' })
  }

  const balance = customerProfileId
    ? await getCustomerBalance(serviceClient, tenantShopId, customerProfileId)
    : 0

  const bonusSpent = capBonusSpend(loyaltySettings, balance, subtotalAfterPromo, requestedBonus)

  if (requestedBonus > 0 && bonusSpent < requestedBonus) {
    throw createError({
      statusCode: 400,
      message: 'Недостаточно бонусов или превышен лимит оплаты бонусами',
    })
  }

  const payableGoods = Math.max(0, subtotalAfterPromo - bonusSpent)

  const fulfillmentType: FulfillmentType =
    body.fulfillmentType === 'pickup'
      ? 'pickup'
      : body.fulfillmentType === 'qr-menu'
        ? 'qr-menu'
        : 'delivery'
  if (!globallyAllowed.includes(fulfillmentType)) {
    throw createError({ statusCode: 400, message: `Fulfillment type "${fulfillmentType}" is disabled` })
  }

  for (const item of body.items) {
    const product = productMap.get(item.id)
    if (!product) {
      throw createError({ statusCode: 400, message: `Product ${item.id} not found in current shop` })
    }
    const availability = evaluateMenuAvailability({
      fulfillmentType,
      productDeliveryRestricted: product.deliveryRestrictedOverride,
      categoryDeliveryRestricted: product.categoryDeliveryRestricted,
      productTimeWindows: normalizeTimeWindows(product.availabilityWindows),
      categoryTimeWindows: normalizeTimeWindows(product.categoryAvailabilityWindows),
    })
    if (!availability.isOrderable) {
      throw createError({
        statusCode: 400,
        message: `Товар "${product.name}" недоступен: ${availability.reason || 'ограничение меню'}`,
      })
    }
  }

  if (fulfillmentType === 'delivery' && !restaurant.supports_delivery) {
    throw createError({ statusCode: 400, message: 'Delivery is not available for selected restaurant' })
  }
  if (fulfillmentType === 'pickup' && !restaurant.supports_pickup) {
    throw createError({ statusCode: 400, message: 'Pickup is not available for selected restaurant' })
  }
  if (fulfillmentType === 'qr-menu' && orgSettings.ops.dineInHallMode === 'qr-menu-browse') {
    throw createError({
      statusCode: 400,
      message: 'Оформление заказа «в зале» недоступно в режиме только просмотра меню',
    })
  }

  const deliveryZone: DeliveryZoneProperties | null =
    fulfillmentType === 'delivery'
      ? (() => {
          // address.zone is required only for delivery
          const incomingZone: DeliveryZoneProperties | null = body.address?.zone ?? null
          const incomingZoneId = typeof incomingZone?.slug === 'string' ? incomingZone.slug.trim() : ''
          return incomingZoneId ? incomingZone : null
        })()
      : null

  let deliveryZoneValidated: DeliveryZoneProperties | null = null
  if (fulfillmentType === 'delivery') {
    if (!deliveryZone) {
      throw createError({ statusCode: 400, message: 'Delivery zone is required for selected restaurant' })
    }
    const incomingZoneId = typeof deliveryZone.slug === 'string' ? deliveryZone.slug.trim() : ''
    const serverZone: TenantRestaurantZone | null = incomingZoneId
      ? await requireRestaurantZoneForShop(event, tenantShopId, restaurant.id, incomingZoneId)
      : null
    deliveryZoneValidated = serverZone
      ? {
          slug: serverZone.id,
          name: serverZone.name,
          minOrderAmount: serverZone.min_order_amount,
          deliveryCost: serverZone.delivery_cost,
          freeDeliveryThreshold: serverZone.free_delivery_threshold,
        }
      : null
  }

  const deliveryCost: number = (() => {
    if (fulfillmentType === 'pickup' || fulfillmentType === 'qr-menu') return 0
    if (!deliveryZoneValidated) return 0
    return subtotalAfterPromo >= deliveryZoneValidated.freeDeliveryThreshold ? 0 : deliveryZoneValidated.deliveryCost
  })()

  const addressLine = body.address?.line?.trim() || null
  const flat = body.address?.flat?.trim() || null
  const comment = body.address?.comment?.trim() || null
  const pickupPoint: PickupPoint | null =
    fulfillmentType === 'pickup' &&
    body.pickupPoint?.id &&
    body.pickupPoint?.name &&
    body.pickupPoint?.address
      ? {
          id: body.pickupPoint.id.trim(),
          name: body.pickupPoint.name.trim(),
          address: body.pickupPoint.address.trim(),
        }
      : null
  const paymentMethod: PaymentMethod = body.paymentMethod || 'cash'
  const changeFrom =
    typeof body.changeFrom === 'number' && Number.isFinite(body.changeFrom) && body.changeFrom > 0
      ? Math.floor(body.changeFrom)
      : null

  const grandTotal = Math.round(payableGoods + deliveryCost)
  if (paymentMethod === 'online' && grandTotal < 1) {
    throw createError({
      statusCode: 400,
      message: 'Минимальная сумма для онлайн-оплаты 1 ₽',
    })
  }

  const promoBreakdown: PromoBreakdown | null =
    discountAmount > 0 || bonusSpent > 0
      ? {
          discountAmount,
          bonusSpent,
          subtotalAfterPromo,
        }
      : null

  const now = new Date()
  // В таблице `public.orders.id` тип `uuid`, поэтому используем UUID, чтобы
  // фронт (и роуты дашборда) могли однозначно находить заказ.
  const orderId = crypto.randomUUID()
  const orderCreatedAtIso = now.toISOString()
  const { data: generatedOrderNumber, error: orderNumberError } = await serviceClient.rpc('next_order_human_number', {
    p_shop_id: tenantShopId,
    p_restaurant_id: restaurant.id,
    p_created_at: orderCreatedAtIso,
  })
  if (orderNumberError) {
    console.error('Failed to generate human order number:', orderNumberError)
    throw createError({ statusCode: 500, message: 'Failed to generate order number' })
  }
  const orderNumber =
    typeof generatedOrderNumber === 'string' && generatedOrderNumber.trim()
      ? generatedOrderNumber.trim()
      : orderId.slice(0, 8)

  // Persist order for dashboard & kitchen.
  // Note: WEB/TMA modes are normalized to `user.id` (Telegram id) above.
  const initialMetadata = {
    timeline: [
      {
        at: orderCreatedAtIso,
        label: 'Заказ создан',
        from: 'new',
        to: 'new',
        source: 'order',
        userId: String(user.id),
        comment: null,
      },
    ],
  }

  const { error: insertError } = await serviceClient.from('orders').insert({
    id: orderId,
    shop_id: tenantShopId,
    restaurant_id: restaurant.id,
    city_id: restaurant.city_id,
    customer_telegram_id: user.id,
    customer_profile_id: customerProfileId,
    order_number: orderNumber,
    status: 'new',
    fulfillment_type: fulfillmentType,
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'online' ? 'pending' : 'unpaid',
    payment_provider: paymentMethod === 'online' ? 'yookassa' : null,
    subtotal: Math.round(subtotalAfterPromo),
    discount_amount: discountAmount,
    bonus_amount_spent: bonusSpent,
    promo_code_id: promoRow?.id ?? null,
    promo_snapshot: promoSnapshot,
    delivery_cost: Math.round(deliveryCost),
    total: grandTotal,
    items: itemsWithServerPrice,
    address:
      fulfillmentType === 'delivery' || fulfillmentType === 'qr-menu'
        ? {
            line: addressLine,
            flat,
            comment,
            zone: deliveryZoneValidated,
          }
        : null,
    pickup_point: fulfillmentType === 'pickup' ? pickupPoint : null,
    comment,
    metadata: initialMetadata,
  })

  if (insertError) {
    console.error('Failed to insert order row:', insertError)
    throw createError({ statusCode: 500, message: 'Failed to create order' })
  }

  if (promoRow) {
    const { error: promoUseErr } = await serviceClient.from('promo_code_uses').insert({
      promo_code_id: promoRow.id,
      shop_id: tenantShopId,
      order_id: orderId,
      customer_profile_id: customerProfileId,
    })
    if (promoUseErr) {
      console.error('promo_code_uses insert:', promoUseErr)
    }
  }

  if (bonusSpent > 0 && customerProfileId) {
    const { error: spendLedErr } = await serviceClient.from('loyalty_ledger').insert({
      shop_id: tenantShopId,
      customer_profile_id: customerProfileId,
      order_id: orderId,
      delta: -bonusSpent,
      reason: 'spend_order',
      meta: {},
    })
    if (spendLedErr) {
      console.error('loyalty_ledger spend_order:', spendLedErr)
    } else {
      const newBal = balance - bonusSpent
      const { error: balErr } = await serviceClient.from('shop_customer_balances').upsert(
        {
          shop_id: tenantShopId,
          customer_profile_id: customerProfileId,
          balance: newBal,
          last_activity_at: orderCreatedAtIso,
        },
        { onConflict: 'shop_id,customer_profile_id' },
      )
      if (balErr) {
        console.error('shop_customer_balances upsert:', balErr)
      }
    }
  }

  await dispatchNotificationEvent(event, {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_CREATED',
    occurredAt: orderCreatedAtIso,
    tenantContext: {
      shopId: tenantShopId,
      restaurantId: restaurant.id,
      cityId: restaurant.city_id,
    },
    orderContext: {
      orderId,
      orderNumber,
      totalAmount: grandTotal,
      status: 'new',
    },
    actorContext: {
      customerTelegramId: user.id,
    },
  })

  return { ok: true, orderId, orderNumber }
})
