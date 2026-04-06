import type { StoryCampaignDto } from '~/types/stories'

export type StoriesCacheEntry = {
  topBar: StoryCampaignDto[]
  catalogGrid: StoryCampaignDto[]
  fetchedAt: number
}

/** Сколько держать кэш в памяти вкладки (мс) */
const TTL_MS = 10 * 60 * 1000

/**
 * Кэш только в памяти, ключ = shop_id ресторана.
 * У каждого ресторана отдельная запись; при смене магазина подставляются только его данные.
 * Без sessionStorage — нет пересечения между вкладками и сессиями браузера.
 */
const memory = new Map<string, StoriesCacheEntry>()

function isFresh(entry: StoriesCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < TTL_MS
}

export function getStoriesFromCache(shopId: string): StoriesCacheEntry | null {
  if (!shopId) return null
  const m = memory.get(shopId)
  if (!m || !isFresh(m)) {
    if (m) memory.delete(shopId)
    return null
  }
  return m
}

export function setStoriesCache(
  shopId: string,
  topBar: StoryCampaignDto[],
  catalogGrid: StoryCampaignDto[],
): void {
  if (!shopId) return
  const entry: StoriesCacheEntry = {
    topBar,
    catalogGrid,
    fetchedAt: Date.now(),
  }
  memory.set(shopId, entry)
}

export function clearStoriesCache(shopId?: string): void {
  if (shopId) {
    memory.delete(shopId)
    return
  }
  memory.clear()
}
