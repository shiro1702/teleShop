import { createError, defineEventHandler, getQuery } from 'h3'

type Cached = { lat: number, lon: number }

/** In-memory cache; process lifetime only. */
const cache = new Map<string, Cached>()
const MAX_CACHE = 800

/** Single-flight dedupe for identical queries. */
const inFlight = new Map<string, Promise<Cached | null>>()

const NOMINATIM_UA = 'TeleShop/1.0 (city aggregator; +https://pocketmenu.ru)'

function cacheKey(fullQuery: string) {
  return fullQuery.trim().toLowerCase()
}

function trimCache() {
  if (cache.size <= MAX_CACHE) return
  const drop = Math.floor(cache.size / 2)
  let i = 0
  for (const k of cache.keys()) {
    cache.delete(k)
    i++
    if (i >= drop) break
  }
}

async function fetchNominatim(fullQuery: string): Promise<Cached | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('q', fullQuery)

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': NOMINATIM_UA,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    return null
  }

  const data = await res.json() as Array<{ lat?: string, lon?: string }>
  const first = Array.isArray(data) ? data[0] : null
  if (!first) return null

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const raw = typeof q.q === 'string' ? q.q.trim() : ''
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'q is required' })
  }

  const city = typeof q.city === 'string' ? q.city.trim() : ''
  const fullQuery = city ? `${raw}, ${city}` : raw
  const key = cacheKey(fullQuery)

  const hit = cache.get(key)
  if (hit) {
    return { ok: true as const, lat: hit.lat, lon: hit.lon, cached: true }
  }

  const pending = inFlight.get(key)
  if (pending) {
    const coords = await pending
    if (!coords) {
      return { ok: false as const, error: 'not_found' as const }
    }
    return { ok: true as const, lat: coords.lat, lon: coords.lon, cached: true }
  }

  const promise = (async () => {
    try {
      const coords = await fetchNominatim(fullQuery)
      if (coords) {
        trimCache()
        cache.set(key, coords)
      }
      return coords
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  const coords = await promise

  if (!coords) {
    return { ok: false as const, error: 'not_found' as const }
  }

  return { ok: true as const, lat: coords.lat, lon: coords.lon, cached: false }
})
