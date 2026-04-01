import type { H3Event } from 'h3'
import { createError, getHeader, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export type TenantShop = {
  id: string
  slug: string
  name: string
  custom_domain?: string | null
  legal_name?: string | null
  inn?: string | null
  ogrn?: string | null
  yookassa_shop_id?: string | null
  yookassa_secret_key?: string | null
  telegram_bot_token: string
  telegram_bot_id: number | null
  manager_chat_id: string | null
  integration_keys: Record<string, unknown> | null
  ui_settings: Record<string, unknown> | null
  is_active: boolean
}

export type TenantRestaurant = {
  id: string
  shop_id: string
  name: string
  address: string
  supports_delivery: boolean
  supports_pickup: boolean
  supports_qr_menu: boolean
  is_active: boolean
}

export type TenantRestaurantZone = {
  id: string
  shop_id: string
  restaurant_id: string
  name: string
  min_order_amount: number
  delivery_cost: number
  free_delivery_threshold: number
  is_active: boolean
}

type CacheEntry = {
  value: TenantShop
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const shopCache = new Map<string, CacheEntry>()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHOP_SELECT_WITH_DOMAIN = 'id,slug,name,custom_domain,legal_name,inn,ogrn,yookassa_shop_id,yookassa_secret_key,telegram_bot_token,telegram_bot_id,manager_chat_id,integration_keys,ui_settings,is_active'
const SHOP_SELECT_WITH_DOMAIN_LEGACY = 'id,slug,name,custom_domain,telegram_bot_token,telegram_bot_id,manager_chat_id,integration_keys,ui_settings,is_active'
const SHOP_SELECT_LEGACY = 'id,slug,name,telegram_bot_token,telegram_bot_id,manager_chat_id,integration_keys,ui_settings,is_active'

function getCached(shopId: string): TenantShop | null {
  const hit = shopCache.get(shopId)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    shopCache.delete(shopId)
    return null
  }
  return hit.value
}

function setCached(shopId: string, value: TenantShop) {
  shopCache.set(shopId, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export function extractShopIdFromInitData(initData: string): string | null {
  const params = new URLSearchParams(initData)
  const startParam = params.get('start_param')
  if (!startParam) return null
  const direct = startParam.match(/shop_(.+)/i)
  if (direct?.[1]) return decodeURIComponent(direct[1]).trim()
  return decodeURIComponent(startParam).trim()
}

export function extractBotIdFromInitData(initData: string): number | null {
  const params = new URLSearchParams(initData)
  const direct = params.get('bot_id')
  if (direct && /^\d+$/.test(direct)) {
    return Number.parseInt(direct, 10)
  }
  return null
}

export async function resolveShopIdFromEvent(event: H3Event): Promise<string | null> {
  const headerShop = getHeader(event, 'x-shop-id')
  if (headerShop?.trim()) return headerShop.trim()

  const query = getQuery(event)
  const queryShop = typeof query.shop_id === 'string' ? query.shop_id : null
  if (queryShop?.trim()) return queryShop.trim()

  const rawInitDataHeader = getHeader(event, 'x-telegram-init-data')
  if (rawInitDataHeader?.trim()) {
    return extractShopIdFromInitData(rawInitDataHeader) ?? null
  }

  return null
}

export async function getShopById(event: H3Event, shopId: string): Promise<TenantShop | null> {
  const shopRef = shopId.trim()
  if (!shopRef) return null
  const cached = getCached(shopRef)
  if (cached) return cached

  const client = await serverSupabaseServiceRole(event)
  const loadShop = async (selectClause: string) => {
    const baseQuery = client
      .from('shops')
      .select(selectClause)
    return UUID_RE.test(shopRef)
      ? await baseQuery.eq('id', shopRef).maybeSingle()
      : await baseQuery.eq('slug', shopRef).maybeSingle()
  }
  const tries = [SHOP_SELECT_WITH_DOMAIN, SHOP_SELECT_WITH_DOMAIN_LEGACY, SHOP_SELECT_LEGACY]
  let data: any = null
  let error: any = null
  for (const clause of tries) {
    const attempt = await loadShop(clause)
    data = attempt.data
    error = attempt.error
    if (!error || data) break
  }

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to read tenant shop config' })
  }
  if (!data) return null

  const shop = data as TenantShop
  // Cache by both incoming reference and canonical identifiers.
  setCached(shopRef, shop)
  setCached(shop.id, shop)
  setCached(shop.slug, shop)
  if (shop.custom_domain) setCached(shop.custom_domain, shop)
  return shop
}

export async function getShopByCustomDomain(event: H3Event, host: string): Promise<TenantShop | null> {
  const normalizedHost = host.trim().toLowerCase()
  if (!normalizedHost) return null

  const cached = getCached(normalizedHost)
  if (cached) return cached

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('shops')
    .select(SHOP_SELECT_WITH_DOMAIN)
    .eq('custom_domain', normalizedHost)
    .maybeSingle()

  if (error) {
    if (/custom_domain/i.test(error.message)) {
      return null
    }
    throw createError({ statusCode: 500, message: 'Failed to read tenant by custom domain' })
  }
  if (!data) return null

  const shop = data as TenantShop
  setCached(normalizedHost, shop)
  setCached(shop.id, shop)
  setCached(shop.slug, shop)
  if (shop.custom_domain) setCached(shop.custom_domain, shop)
  return shop
}

export async function getShopByBotId(event: H3Event, botId: number): Promise<TenantShop | null> {
  const client = await serverSupabaseServiceRole(event)
  const loadShop = async (selectClause: string) =>
    client
      .from('shops')
      .select(selectClause)
      .eq('telegram_bot_id', botId)
      .maybeSingle()

  const tries = [SHOP_SELECT_WITH_DOMAIN, SHOP_SELECT_WITH_DOMAIN_LEGACY, SHOP_SELECT_LEGACY]
  let data: any = null
  let error: any = null
  for (const clause of tries) {
    const attempt = await loadShop(clause)
    data = attempt.data
    error = attempt.error
    if (!error || data) break
  }

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to read tenant by bot id' })
  }
  if (!data) return null
  const shop = data as TenantShop
  setCached(shop.id, shop)
  setCached(shop.slug, shop)
  if (shop.custom_domain) setCached(shop.custom_domain, shop)
  return shop
}

export async function requireTenantShop(event: H3Event): Promise<{ shopId: string; shop: TenantShop }> {
  const tenant = event.context.tenant
  if (tenant?.shopId && tenant.shop?.is_active) {
    return { shopId: tenant.shopId, shop: tenant.shop }
  }

  const shopId = await resolveShopIdFromEvent(event)
  if (!shopId) {
    throw createError({ statusCode: 400, message: 'Missing shop_id' })
  }

  const shop = await getShopById(event, shopId)
  if (!shop || !shop.is_active) {
    throw createError({ statusCode: 404, message: 'Shop not found' })
  }

  return { shopId, shop }
}

/**
 * Проверяет, что shop_id из тела запроса относится к тому же магазину, что и tenant-контекст.
 * В теле можно передать UUID магазина или его slug — оба сопоставляются с `shops.id`.
 * Если поле не передано, проверка пропускается (используется только tenant).
 */
export async function assertShopIdMatchesTenant(
  event: H3Event,
  payloadShopId: string | null | undefined,
  tenantShopId: string,
): Promise<void> {
  const normalized = typeof payloadShopId === 'string' ? payloadShopId.trim() : ''
  if (!normalized) return

  const shop = await getShopById(event, normalized)
  if (!shop || shop.id !== tenantShopId) {
    throw createError({ statusCode: 400, message: 'shop_id does not match tenant context' })
  }
}

export async function requireRestaurantForShop(
  event: H3Event,
  shopId: string,
  restaurantId: string,
): Promise<TenantRestaurant> {
  const normalizedRestaurantId = restaurantId.trim()
  if (!normalizedRestaurantId) {
    throw createError({ statusCode: 400, message: 'restaurantId is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('id,shop_id,name,address,supports_delivery,supports_pickup,supports_qr_menu,is_active')
    .eq('shop_id', shopId)
    .eq('id', normalizedRestaurantId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error querying restaurant for shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurant for this shop' })
  }
  if (!data) {
    throw createError({ statusCode: 400, message: 'Restaurant is not available for this shop' })
  }
  return data as TenantRestaurant
}

export async function requireRestaurantZoneForShop(
  event: H3Event,
  shopId: string,
  restaurantId: string,
  zoneId: string,
): Promise<TenantRestaurantZone> {
  const normalizedZoneId = zoneId.trim()
  if (!normalizedZoneId) {
    throw createError({ statusCode: 400, message: 'Delivery zone is required for selected restaurant' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurant_delivery_zones')
    .select('id,shop_id,restaurant_id,name,min_order_amount,delivery_cost,free_delivery_threshold,is_active')
    .eq('shop_id', shopId)
    .eq('restaurant_id', restaurantId)
    .eq('id', normalizedZoneId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error querying delivery zone for restaurant:', error)
    throw createError({ statusCode: 500, message: 'Failed to load delivery zone for this restaurant' })
  }
  if (!data) {
    throw createError({ statusCode: 400, message: 'Delivery zone is required for selected restaurant' })
  }

  return data as TenantRestaurantZone
}
