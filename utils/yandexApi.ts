const API_BASE = 'https://suggest-maps.yandex.ru'
const GEOCODER_BASE = 'https://geocode-maps.yandex.ru/1.x'

interface YandexSuggestItem {
  displayName: string
  value: string
}

interface YandexGeocodeResult {
  lat: number
  lon: number
  fullAddress: string
}

export async function yandexSuggest(query: string): Promise<YandexSuggestItem[]> {
  const config = useRuntimeConfig()
  const apiKey =
    config.yandexGeocoderApiKey ||
    config.yandexMapsApiKey ||
    config.public?.yandexMapsApiKey

  if (!apiKey || !query.trim()) return []

  const url = new URL(`${API_BASE}/v1/suggest`)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('text', query)
  url.searchParams.set('lang', 'ru_RU')
  // Центр Улан-Удэ, чтобы подсказки были релевантны городу
  url.searchParams.set('ll', '107.609,51.833') // lon,lat
  url.searchParams.set('print_address', '1')

  try {
    const res = await $fetch<any>(url.toString())
    if (!res || !Array.isArray(res.results)) return []

    return res.results.map((item: any) => ({
      displayName: item.displayName?.text ?? item.title?.text ?? '',
      value: item.uri ?? item.displayName?.text ?? '',
    }))
  } catch {
    return []
  }
}

export async function yandexGeocode(query: string): Promise<YandexGeocodeResult | null> {
  const config = useRuntimeConfig()
  const apiKey =
    config.yandexGeocoderApiKey ||
    config.yandexMapsApiKey ||
    config.public?.yandexMapsApiKey

  if (!apiKey || !query.trim()) return null

  const url = new URL(GEOCODER_BASE)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('geocode', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('lang', 'ru_RU')

  try {
    const res = await $fetch<any>(url.toString())
    const member =
      res?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject ?? null
    if (!member) return null

    const pos: string | undefined = member.Point?.pos
    if (!pos) return null
    const [lonStr, latStr] = pos.split(' ')
    const lon = Number(lonStr)
    const lat = Number(latStr)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null

    const fullAddress: string =
      member.metaDataProperty?.GeocoderMetaData?.text ?? query

    return { lat, lon, fullAddress }
  } catch {
    return null
  }
}

