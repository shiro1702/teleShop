import { ref, watch, type Ref } from 'vue'
import { $fetch } from 'ofetch'
import type { StoriesApiResponse, StoryCampaignDto } from '~/types/stories'
import { getStoriesFromCache, setStoriesCache } from '~/utils/storiesCache'

/** Чтобы лоадер не «висел», если API не отвечает */
const FETCH_TIMEOUT_MS = 12_000

export function useStories(shopIdRef: Ref<string | null | undefined>) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const topBar = ref<StoryCampaignDto[]>([])
  const catalogGrid = ref<StoryCampaignDto[]>([])

  let loadGeneration = 0

  async function load() {
    const shopId = shopIdRef.value
    if (!shopId) {
      topBar.value = []
      catalogGrid.value = []
      loading.value = false
      error.value = null
      return
    }

    const cached = getStoriesFromCache(shopId)
    if (cached) {
      topBar.value = cached.topBar
      catalogGrid.value = cached.catalogGrid
      loading.value = false
      error.value = null
      return
    }

    const myGen = ++loadGeneration
    topBar.value = []
    catalogGrid.value = []
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<StoriesApiResponse>('/api/stories', {
        headers: { 'x-shop-id': shopId },
        query: { shop_id: shopId },
        timeout: FETCH_TIMEOUT_MS,
      })
      if (myGen !== loadGeneration) return

      if (res?.ok) {
        const tb = res.topBar ?? []
        const cg = res.catalogGrid ?? []
        topBar.value = tb
        catalogGrid.value = cg
        setStoriesCache(shopId, tb, cg)
      } else {
        topBar.value = []
        catalogGrid.value = []
      }
    } catch (e: unknown) {
      if (myGen !== loadGeneration) return
      error.value = e instanceof Error ? e.message : 'Failed to load stories'
      topBar.value = []
      catalogGrid.value = []
    } finally {
      if (myGen === loadGeneration) {
        loading.value = false
      }
    }
  }

  watch(shopIdRef, () => {
    void load()
  }, { immediate: true })

  return {
    loading,
    error,
    topBar,
    catalogGrid,
    load,
  }
}
