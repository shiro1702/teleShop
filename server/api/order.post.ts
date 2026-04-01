// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — типы Node могут быть не подключены в проекте
import crypto from 'node:crypto'
import type { H3Event } from 'h3'
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
import { applyGlobalFulfillmentPolicy } from '~/server/utils/platformOperationSettings'
import {
  catalogGroupsToOrderValidationShape,
  fetchProductParameterGroupsByProductId,
} from '~/server/utils/productParametersCatalog'

interface SelectedModifierPayload {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  pricingType?: 'delta' | 'multiplier'
  priceDelta: number
  priceMultiplier?: number | null
}

interface SelectedParameterPayload {
  parameterKindId: string
  productParameterId: string
  optionId: string
  optionName: string
  price: number
  weightG?: number | null
  volumeMl?: number | null
  pieces?: number | null
}

interface CartItemPayload {
  id: string
  cartItemId?: string
  name: string
  price: number
  quantity: number
  selectedModifiers?: SelectedModifierPayload[]
  selectedParameters?: SelectedParameterPayload[]
}

interface ProductRow {
  id: string
  name: string
  price: number
  parameters: any[]
}

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
  },
): string {
  const username = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`
  const grandTotal = total + deliveryCost
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

  const lines: string[] = [
    `📦 Заказ #${orderRef}`,
    '',
    'Состав:',
    ...formattedItems,
    '',
    `💰 Товары: ${formatPrice(total)}`,
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
  },
): string {
  const grandTotal = total + deliveryCost
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

  const lines: string[] = [
    `🧾 Ваш заказ #${orderRef} принят!`,
    '',
    'Состав заказа:',
    ...formattedItems,
    '',
    `💰 Товары: ${formatPrice(total)}`,
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

async function loadTenantProductsForOrder(
  event: H3Event,
  shopId: string,
  productIds: string[],
): Promise<Map<string, ProductRow>> {
  const serviceClient = await serverSupabaseServiceRole(event)
  const { data, error } = await serviceClient
    .from('products')
    .select('id,name,price,category_id')
    .eq('shop_id', shopId)
    .in('id', productIds)

  if (error) {
    console.error('Error querying products for order:', error)
    throw createError({ statusCode: 500, message: 'Failed to load products for this shop' })
  }

  const rows = (Array.isArray(data) ? data : []) as any[]
  const paramByProduct = await fetchProductParameterGroupsByProductId(serviceClient, shopId, rows)

  const map = new Map<string, ProductRow>()
  for (const row of rows) {
    const groups = paramByProduct[row.id]
    map.set(row.id, {
      id: row.id,
      name: row.name,
      price: row.price,
      parameters: groups ? catalogGroupsToOrderValidationShape(groups) : [],
    })
  }
  return map
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { shopId: tenantShopId, shop: tenantShop } = await requireTenantShop(event)
  const tenantIntegrationKeys = tenantShop.integration_keys ?? {}
  const tenant = event.context.tenant
  const botToken = tenant?.telegramBotToken || (config.botToken as string)
  const managerChatId = (
    typeof tenantShop.manager_chat_id === 'string' && tenantShop.manager_chat_id.trim()
      ? tenantShop.manager_chat_id
      : typeof tenantIntegrationKeys.manager_chat_id === 'string'
        ? tenantIntegrationKeys.manager_chat_id
        : config.managerChatId
  ) as string
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

  if (!botToken || !managerChatId) {
    throw createError({ statusCode: 500, message: 'Server config: bot token or manager chat ID missing' })
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

  // Пересчитываем сумму на сервере по tenant-каталогу, не доверяя ценам с клиента
  const uniqueProductIds = Array.from(new Set(body.items.map((item) => item.id)))
  const productMap = await loadTenantProductsForOrder(event, tenantShopId, uniqueProductIds)

  // TODO: В идеале нужно также валидировать цены модификаторов на сервере
  const itemsWithServerPrice: CartItemPayload[] = body.items.map((item) => {
    const product = productMap.get(item.id)
    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Product ${item.id} not found in current shop`,
      })
    }
    const quantity = item.quantity > 0 ? item.quantity : 0
    
    let basePrice = product.price
    if (item.selectedParameters && item.selectedParameters.length > 0) {
      const param = item.selectedParameters[0]
      const dbParamGroup = product.parameters?.find((p: any) => p.id === param.productParameterId)
      if (dbParamGroup) {
        const dbOption = dbParamGroup.product_parameter_options?.find((o: any) => o.id === param.optionId && o.is_active)
        if (dbOption) {
          basePrice = dbOption.price
        } else {
          throw createError({
            statusCode: 400,
            message: `Invalid parameter option ${param.optionId} for product ${item.id}`,
          })
        }
      }
    } else if (product.parameters && product.parameters.some((p: any) => p.is_required)) {
      throw createError({
        statusCode: 400,
        message: `Product ${item.id} requires parameter selection`,
      })
    }

    let multiplier = 1
    let delta = 0
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      for (const mod of item.selectedModifiers) {
        if (mod.pricingType === 'multiplier') {
          multiplier *= (mod.priceMultiplier ?? 1)
        } else {
          delta += (mod.priceDelta || 0)
        }
      }
    }
    const unitPrice = Math.round(basePrice * multiplier + delta)
    
    return {
      id: product.id,
      cartItemId: item.cartItemId,
      name: product.name,
      price: unitPrice,
      quantity,
      selectedModifiers: item.selectedModifiers,
      selectedParameters: item.selectedParameters
    }
  })

  const total = itemsWithServerPrice.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const fulfillmentType: FulfillmentType =
    body.fulfillmentType === 'pickup'
      ? 'pickup'
      : body.fulfillmentType === 'qr-menu'
        ? 'qr-menu'
        : 'delivery'
  if (!globallyAllowed.includes(fulfillmentType)) {
    throw createError({ statusCode: 400, message: `Fulfillment type "${fulfillmentType}" is disabled` })
  }
  if (fulfillmentType === 'delivery' && !restaurant.supports_delivery) {
    throw createError({ statusCode: 400, message: 'Delivery is not available for selected restaurant' })
  }
  if (fulfillmentType === 'pickup' && !restaurant.supports_pickup) {
    throw createError({ statusCode: 400, message: 'Pickup is not available for selected restaurant' })
  }
  // QR-меню управляется настройками ops.fulfillmentTypes (глобально/для организации),
  // а не колонкой supports_qr_menu у конкретного ресторана.

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
    return total >= deliveryZoneValidated.freeDeliveryThreshold ? 0 : deliveryZoneValidated.deliveryCost
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

  // Определяем пользователя: либо через initData (TMA), либо через Supabase-сессию (WEB)
  let user: TelegramUser | null = null
  let customerProfileId: string | null = null
  if (body.initData && typeof body.initData === 'string') {
    // Telegram Mini App: авторизация через initData
    user = validateInitData(body.initData, botToken)
    if (!user) {
      throw createError({ statusCode: 401, message: 'Invalid initData' })
    }
  } else {
    // Веб-режим: авторизация через Supabase-сессию и profiles.telegram_id
    const supabaseUser = await serverSupabaseUser(event)
    if (!supabaseUser) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }

    // В Supabase JWT id может лежать в поле sub, а не id.
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

    const serviceClient = await serverSupabaseServiceRole(event)

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
      // Пользователь авторизован в Supabase, но Telegram еще не привязан
      throw createError({ statusCode: 409, message: 'Telegram not linked' })
    }

    user = {
      id: profile.telegram_id as number,
    }
  }

  const now = new Date()
  // В таблице `public.orders.id` тип `uuid`, поэтому используем UUID, чтобы
  // фронт (и роуты дашборда) могли однозначно находить заказ.
  const orderId = crypto.randomUUID()
  const orderCreatedAtIso = now.toISOString()
  const serviceClient = await serverSupabaseServiceRole(event)
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

  const text = buildOrderMessage(orderNumber, itemsWithServerPrice, total, deliveryCost, fulfillmentType === 'delivery' ? deliveryZoneValidated : null, user, {
    fulfillmentType,
    pickupPoint,
    addressLine,
    flat,
    comment,
    paymentMethod,
    changeFrom,
  })

  const callbackData = `work_${user.id}_${orderId}`
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — Buffer может быть не типизирован без @types/node
  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    throw createError({ statusCode: 500, message: 'callback_data too long' })
  }

  const payload: any = {
    chat_id: managerChatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принять в работу', callback_data: callbackData },
          { text: '⏱ Задержка (кухня)', callback_data: `delayWork_${user.id}_${orderId}` },
        ],
        [
          { text: '✉️ Написать клиенту', url: `tg://user?id=${user.id}` },
        ],
      ],
    },
  }

  // Persist order for dashboard & kitchen.
  // Note: WEB/TMA modes are normalized to `user.id` (Telegram id) above.
  const grandTotal = Math.round(total + deliveryCost)
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
    customer_telegram_id: user.id,
    customer_profile_id: customerProfileId,
    order_number: orderNumber,
    status: 'new',
    fulfillment_type: fulfillmentType,
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'online' ? 'pending' : 'unpaid',
    payment_provider: paymentMethod === 'online' ? 'yookassa' : null,
    subtotal: Math.round(total),
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

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Telegram sendMessage error:', res.status, err)
    throw createError({ statusCode: 502, message: 'Failed to send message to manager' })
  }

  // Дополнительное уведомление клиента о создании заказа (ошибки не критичны)
  try {
    const clientText = buildClientOrderMessage(orderNumber, itemsWithServerPrice, total, deliveryCost, fulfillmentType === 'delivery' ? deliveryZoneValidated : null, {
      fulfillmentType,
      pickupPoint,
      addressLine,
      flat,
      comment,
      paymentMethod,
      changeFrom,
    })
    const clientPayload: any = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.id,
        text: clientText,
      }),
    }

    // Кнопка "написать менеджеру" ведёт в чат с ботом
    const config = useRuntimeConfig()
    const telegramBotName = (config.public?.telegramBotName as string | undefined) || ''
    if (telegramBotName) {
      const payloadBody = JSON.parse(clientPayload.body as string)
      payloadBody.reply_markup = {
        inline_keyboard: [[{ text: '✉️ Написать менеджеру', url: `https://t.me/${telegramBotName}` }]],
      }
      clientPayload.body = JSON.stringify(payloadBody)
    }

    await fetch(url, clientPayload)
  } catch (notifyErr) {
    console.error('Telegram notify client error:', notifyErr)
  }

  return { ok: true, orderId, orderNumber }
})
