import { useTelegram } from '~/composables/useTelegram'

export type TenantRestaurantsApiResponse<TItem> = {
  ok: boolean
  items: TItem[]
  organizationTimezone?: string
  dineInHallMode?: 'qr-menu-browse' | 'to-table' | 'pickup-point'
}

type CacheEntry = {
  ts: number
  data: TenantRestaurantsApiResponse<any>
}

const RESTAURANTS_CACHE_TTL_MS = 60 * 1000
const restaurantsCache = new Map<string, CacheEntry>()
const restaurantsInFlight = new Map<string, Promise<TenantRestaurantsApiResponse<any>>>()

function normalizeShopId(shopId: string | null | undefined): string {
  return typeof shopId === 'string' ? shopId.trim() : ''
}

function normalizeFestivalSlug(festivalSlug: string | null | undefined): string {
  return typeof festivalSlug === 'string' ? festivalSlug.trim() : ''
}

export function useTenantRestaurantsCache<TItem extends { id: string }>() {
  const { buildMessengerAuthHeaders, messengerInitData } = useTelegram()

  function buildLoadKey(shopId: string | null | undefined, festivalSlug?: string | null): string {
    const shop = normalizeShopId(shopId)
    const festival = normalizeFestivalSlug(festivalSlug)
    const initFlag = messengerInitData.value ? '1' : '0'
    return `${shop}\t${festival}\t${initFlag}`
  }

  async function loadRestaurants(options: { shopId: string | null | undefined; festivalSlug?: string | null; force?: boolean }) {
    const shop = normalizeShopId(options.shopId)
    const festival = normalizeFestivalSlug(options.festivalSlug)
    const key = buildLoadKey(shop, festival)
    const now = Date.now()
    const cached = restaurantsCache.get(key)
    if (!options.force && cached && now - cached.ts <= RESTAURANTS_CACHE_TTL_MS) {
      return cached.data as TenantRestaurantsApiResponse<TItem>
    }

    const inFlight = restaurantsInFlight.get(key)
    if (!options.force && inFlight) {
      return inFlight as Promise<TenantRestaurantsApiResponse<TItem>>
    }

    const request = $fetch<TenantRestaurantsApiResponse<TItem>>('/api/restaurants', {
      query: {
        ...(shop ? { shop_id: shop } : {}),
        ...(festival ? { festival_slug: festival } : {}),
      },
      headers: buildMessengerAuthHeaders(shop ? { 'x-shop-id': shop } : undefined),
    })
      .then((response) => {
        restaurantsCache.set(key, { ts: Date.now(), data: response })
        return response
      })
      .finally(() => {
        restaurantsInFlight.delete(key)
      })

    restaurantsInFlight.set(key, request as Promise<TenantRestaurantsApiResponse<any>>)
    return request
  }

  return {
    loadRestaurants,
  }
}
