import type { StoryActionType, StoryCampaignDto, StorySlideDto } from '~/types/stories'

/** Unsplash food / promo style images for local/demo when БД без кампаний */
const IMAGES = [
  '1544025162-d76694265947',
  '1555939594-58d7cb561ad1',
  '1565299624946-b28f40a0ae38',
  '1567620905732-2d1ec7ab7445',
  '1512058566846-da385a02827f',
  '1551218808-94e220ab6718',
  '1493770348161-369560ae357d',
  '1504674900800-33a096f7ad32',
  '1559339352-11d035aa65de',
  '1563379926898-05f4615a45da',
  '1571091718767-18b0059f8d3a',
  '1540189549336-e6e99c3679fe',
  '1562967914-608f82629710',
  '1556910103-1c02745aae4d',
]

function img(ix: number): string {
  const id = IMAGES[ix % IMAGES.length]
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`
}

/**
 * 7 тестовых групп: 1–4 сторис в каждой (итого 7 групп).
 * Часть в ленте сверху, часть — для вставки в каталог.
 */
export function buildDemoStoryCampaigns(_shopId: string): StoryCampaignDto[] {
  const slideCounts = [1, 2, 3, 4, 1, 2, 3]
  const titles = [
    '[DEMO] Бонусы за отзыв',
    '[DEMO] Подарок на первый заказ',
    '[DEMO] Кэшбэк',
    '[DEMO] Счастливые часы',
    '[DEMO] Скидка в день рождения',
    '[DEMO] Новинки недели',
    '[DEMO] Сеты на компанию',
  ]
  let imgCursor = 0

  return slideCounts.map((n, g) => {
    const id = `demo-campaign-${g + 1}`
    const placement: StoryCampaignDto['placement'] = g < 4 ? 'top_bar' : 'catalog_grid'
    const slides: StorySlideDto[] = Array.from({ length: n }, (_, i) => {
      const url = img(imgCursor++)
      return {
        id: `demo-slide-${g + 1}-${i + 1}`,
        campaignId: id,
        sortOrder: i,
        mediaUrl: url,
        durationSeconds: 5,
        actionType: (i === n - 1 ? 'open_category' : 'none') as StoryActionType,
        actionPayload:
          i === n - 1 ? { category: 'Основные блюда' } : {},
      }
    })
    return {
      id,
      title: titles[g] ?? `[DEMO] Группа ${g + 1}`,
      previewUrl: slides[0]?.mediaUrl ?? null,
      placement,
      targeting: {},
      slides,
    }
  })
}
