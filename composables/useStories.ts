import { ref, watch, type Ref } from 'vue'
import { $fetch } from 'ofetch'
import type { StoriesApiResponse, StoryCampaignDto } from '~/types/stories'
import { getStoriesFromCache, setStoriesCache } from '~/utils/storiesCache'

export function useStories(shopIdRef: Ref<string | null | undefined>) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const topBar = ref<StoryCampaignDto[]>([])
  const catalogGrid = ref<StoryCampaignDto[]>([])

  async function load() {
    const shopId = shopIdRef.value
    if (!shopId) {
      topBar.value = []
      catalogGrid.value = []
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

    loading.value = true
    error.value = null
    try {
      const res = await $fetch<StoriesApiResponse>('/api/stories', {
        headers: { 'x-shop-id': shopId },
        query: { shop_id: shopId },
      })
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
      error.value = e instanceof Error ? e.message : 'Failed to load stories'
      topBar.value = []
      catalogGrid.value = []
    } finally {
      loading.value = false
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
