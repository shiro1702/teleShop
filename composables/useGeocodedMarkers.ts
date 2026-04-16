import { $fetch } from 'ofetch'

export type MapPointInput = {
  id: string
  title: string
  subtitle?: string
  address: string
  lat?: number | null
  lon?: number | null
}

export type MapPointResolved = MapPointInput & { lat: number, lon: number }

/**
 * Геокодирование через серверный /api/geocode (Nominatim + кэш).
 * Ограничение параллелизма — чтобы не превышать разумную нагрузку на Nominatim.
 */
export async function geocodeMarkers(
  points: MapPointInput[],
  cityName: string | undefined,
  concurrency = 3,
): Promise<{ resolved: MapPointResolved[], failed: number }> {
  const resolved: MapPointResolved[] = []
  let failed = 0
  const queue: MapPointInput[] = []

  for (const p of points) {
    const lat = typeof p.lat === 'number' && Number.isFinite(p.lat) ? p.lat : null
    const lon = typeof p.lon === 'number' && Number.isFinite(p.lon) ? p.lon : null
    if (lat != null && lon != null) {
      resolved.push({ ...p, lat, lon })
      continue
    }
    queue.push(p)
  }

  if (!queue.length) {
    return { resolved, failed }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const p = queue.shift()
      if (!p) break
      try {
        const res = await $fetch<{ ok: boolean, lat?: number, lon?: number }>('/api/geocode', {
          query: {
            q: p.address,
            ...(cityName?.trim() ? { city: cityName.trim() } : {}),
          },
        })
        if (res?.ok && typeof res.lat === 'number' && typeof res.lon === 'number') {
          resolved.push({ ...p, lat: res.lat, lon: res.lon })
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
  })
  await Promise.all(workers)
  return { resolved, failed }
}
