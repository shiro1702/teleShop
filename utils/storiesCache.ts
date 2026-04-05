import type { StoryCampaignDto } from '~/types/stories'

export type StoriesCacheEntry = {
  topBar: StoryCampaignDto[]
  catalogGrid: StoryCampaignDto[]
  fetchedAt: number
}

/** Сколько держать кэш до фонового обновления (мс) */
const TTL_MS = 10 * 60 * 1000

const memory = new Map<string, StoriesCacheEntry>()

const STORAGE_PREFIX = 'teleshop:stories:v1:'

function isFresh(entry: StoriesCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < TTL_MS
}

export function getStoriesFromCache(shopId: string): StoriesCacheEntry | null {
  const m = memory.get(shopId)
  if (m && isFresh(m)) return m

  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + shopId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoriesCacheEntry
    if (
      !parsed ||
      typeof parsed.fetchedAt !== 'number' ||
      !Array.isArray(parsed.topBar) ||
      !Array.isArray(parsed.catalogGrid)
    ) {
      sessionStorage.removeItem(STORAGE_PREFIX + shopId)
      return null
    }
    if (!isFresh(parsed)) {
      sessionStorage.removeItem(STORAGE_PREFIX + shopId)
      return null
    }
    memory.set(shopId, parsed)
    return parsed
  } catch {
    return null
  }
}

export function setStoriesCache(
  shopId: string,
  topBar: StoryCampaignDto[],
  catalogGrid: StoryCampaignDto[],
): void {
  const entry: StoriesCacheEntry = {
    topBar,
    catalogGrid,
    fetchedAt: Date.now(),
  }
  memory.set(shopId, entry)
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + shopId, JSON.stringify(entry))
  } catch {
    // квота / приватный режим
  }
}

export function clearStoriesCache(shopId?: string): void {
  if (shopId) {
    memory.delete(shopId)
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_PREFIX + shopId)
      } catch {
        // ignore
      }
    }
    return
  }
  memory.clear()
  if (typeof sessionStorage === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}
