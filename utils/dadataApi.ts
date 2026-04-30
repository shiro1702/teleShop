export interface DadataSuggestItem {
  displayName: string
  value: string
  lat: number | null
  lon: number | null
}

export async function dadataSuggest(query: string): Promise<DadataSuggestItem[]> {
  if (!query.trim()) {
    return []
  }

  try {
    const res = await $fetch<{ items?: DadataSuggestItem[] }>('/api/dadata/suggest', {
      method: 'POST',
      body: { query },
    })
    return Array.isArray(res?.items) ? res.items : []
  } catch {
    return []
  }
}

