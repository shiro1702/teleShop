const DADATA_SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'

export interface DadataSuggestItem {
  displayName: string
  value: string
  lat: number | null
  lon: number | null
}

export async function dadataSuggest(query: string): Promise<DadataSuggestItem[]> {
  const config = useRuntimeConfig()
  const token: string | undefined =
    (config.dadataToken as string | undefined) ||
    (config.public?.dadataToken as string | undefined)

  if (!token || !query.trim()) {
    return []
  }

  try {
    const body = {
      query,
      count: 8,
      // Фильтруем по городу, чтобы подсказки были локальными
      locations: [
        {
          city: 'Улан-Удэ',
        },
      ],
    }

    const res = await $fetch<any>(DADATA_SUGGEST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    })

    if (!res || !Array.isArray(res.suggestions)) {
      return []
    }

    return res.suggestions.map((item: any) => {
      const data = item.data ?? {}
      const lat = data.geo_lat != null ? Number(data.geo_lat) : null
      const lon = data.geo_lon != null ? Number(data.geo_lon) : null

      return {
        displayName: item.value as string,
        value: item.unrestricted_value as string,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      }
    })
  } catch {
    return []
  }
}

