import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { resolveCartScopeKey } from '~/utils/cartScope'

export type UserFulfillmentType = 'delivery' | 'pickup' | 'qr-menu'
export type CityFulfillmentType = 'delivery' | 'pickup' | 'dine-in'

const FULFILLMENT_STORAGE_KEY = 'teleshop-fulfillment-preferences'
const FALLBACK_PRIORITY: UserFulfillmentType[] = ['pickup', 'delivery', 'qr-menu']
type FulfillmentStorageShape = {
  city?: Record<string, CityFulfillmentType>
}

function readStorage(): FulfillmentStorageShape {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(FULFILLMENT_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as FulfillmentStorageShape
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeStorage(next: FulfillmentStorageShape) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FULFILLMENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota/private mode
  }
}

export function writeCityFulfillmentMode(citySlug: string | null | undefined, next: CityFulfillmentType) {
  const slug = typeof citySlug === 'string' ? citySlug.trim() : ''
  if (!slug) return
  const state = readStorage()
  state.city = state.city ?? {}
  state.city[slug] = next
  writeStorage(state)
}

export function readCityFulfillmentMode(citySlug: string | null | undefined): CityFulfillmentType | null {
  const slug = typeof citySlug === 'string' ? citySlug.trim() : ''
  if (!slug) return null
  const raw = readStorage().city?.[slug]
  if (raw === 'delivery' || raw === 'pickup' || raw === 'dine-in') return raw
  return null
}

export function mapCityModeToFulfillment(mode: CityFulfillmentType | null): UserFulfillmentType | null {
  if (mode === 'delivery') return 'delivery'
  if (mode === 'pickup') return 'pickup'
  if (mode === 'dine-in') return 'qr-menu'
  return null
}

export function mapFulfillmentToCityMode(mode: UserFulfillmentType | null): CityFulfillmentType | null {
  if (mode === 'delivery') return 'delivery'
  if (mode === 'pickup') return 'pickup'
  if (mode === 'qr-menu') return 'dine-in'
  return null
}

export function resolveFulfillmentByPreference(input: {
  allowed: UserFulfillmentType[]
  preferred?: UserFulfillmentType | null
  cityMode?: CityFulfillmentType | null
  current?: UserFulfillmentType | null
}): UserFulfillmentType | null {
  const allowed = input.allowed
  if (!allowed.length) return null
  const allowedSet = new Set(allowed)
  if (input.preferred && allowedSet.has(input.preferred)) return input.preferred
  const cityMapped = mapCityModeToFulfillment(input.cityMode ?? null)
  if (cityMapped && allowedSet.has(cityMapped)) return cityMapped
  if (input.current && allowedSet.has(input.current)) return input.current
  for (const candidate of FALLBACK_PRIORITY) {
    if (allowedSet.has(candidate)) return candidate
  }
  return allowed[0] ?? null
}

export function resolveFulfillmentScopeFromRoute(route: RouteLocationNormalizedLoaded, tenantKey?: string | null): string | null {
  return resolveCartScopeKey(route, tenantKey)
}
