import type { Product } from '~/data/products'

export type StoryActionType = 'add_to_cart' | 'apply_promo' | 'open_category' | 'none'

export type StorySlideDto = {
  id: string
  campaignId: string
  sortOrder: number
  mediaUrl: string
  durationSeconds: number
  actionType: StoryActionType
  actionPayload: Record<string, unknown>
  title?: string | null
  text?: string | null
}

export type StoryCampaignDto = {
  id: string
  title: string
  previewUrl: string | null
  placement: 'top_bar' | 'catalog_grid'
  targeting?: unknown
  slides: StorySlideDto[]
}

export type StoriesApiResponse = {
  ok: boolean
  shopId: string
  topBar: StoryCampaignDto[]
  catalogGrid: StoryCampaignDto[]
  campaigns: StoryCampaignDto[]
}

export type CatalogCell =
  | { type: 'product'; product: Product }
  | { type: 'story'; campaign: StoryCampaignDto }
