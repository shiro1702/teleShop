import { createError, defineEventHandler, readBody } from 'h3'

const DADATA_SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'

type DadataSuggestion = {
  value?: string
  unrestricted_value?: string
  data?: {
    geo_lat?: string | number | null
    geo_lon?: string | number | null
  } | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const token = String(config.dadataToken || config.public?.dadataToken || '').trim()
  if (!token) {
    return { ok: true as const, items: [] as Array<{ displayName: string; value: string; lat: number | null; lon: number | null }> }
  }

  const body = await readBody<{ query?: string | null } | null>(event).catch(() => null)
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  if (!query) {
    throw createError({ statusCode: 400, statusMessage: 'query is required' })
  }

  const payload = {
    query,
    count: 8,
    locations: [{ city: 'Улан-Удэ' }],
  }

  try {
    const res = await $fetch<{ suggestions?: DadataSuggestion[] }>(DADATA_SUGGEST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload,
    })

    const suggestions = Array.isArray(res?.suggestions) ? res.suggestions : []
    const items = suggestions.map((item) => {
      const latRaw = item.data?.geo_lat
      const lonRaw = item.data?.geo_lon
      const lat = latRaw != null ? Number(latRaw) : null
      const lon = lonRaw != null ? Number(lonRaw) : null

      return {
        displayName: String(item.value || ''),
        value: String(item.unrestricted_value || item.value || ''),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      }
    }).filter((item) => item.displayName)

    return { ok: true as const, items }
  } catch {
    return { ok: true as const, items: [] as Array<{ displayName: string; value: string; lat: number | null; lon: number | null }> }
  }
})
