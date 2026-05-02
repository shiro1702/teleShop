import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { isShopFeatureEnabled } from '~/server/utils/features'
import { getShopById, requireTenantShop } from '~/server/utils/tenant'
import { computePublicRating } from '~/server/utils/reviewsAggregation'
import { parseListLimit } from '~/server/utils/reviews'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const restaurantId = typeof query.restaurant_id === 'string' && query.restaurant_id.trim() ? query.restaurant_id.trim() : ''
  const shopRef = typeof query.shop_id === 'string' ? query.shop_id.trim() : ''
  const limit = parseListLimit(query.limit, 20, 50)

  let shopId = ''
  if (shopRef) {
    const shop = await getShopById(event, shopRef)
    if (!shop) throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
    shopId = shop.id
  } else {
    const tenant = await requireTenantShop(event)
    shopId = tenant.shopId
  }

  const moduleEnabled = await isShopFeatureEnabled(event, shopId, 'reputation_reviews_pro')
  if (!moduleEnabled) {
    return {
      ok: true,
      moduleEnabled: false,
      items: [],
      rating: {
        public_rating: null,
        sample_count: 0,
        formula: 'Рейтинг рассчитан по последним 20 опубликованным отзывам',
      },
    }
  }

  const client = await serverSupabaseServiceRole(event)
  let reviewsQuery = client
    .from('shop_reviews')
    .select('id,shop_id,restaurant_id,rating,comment,video_url,published_at,created_at')
    .eq('shop_id', shopId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (restaurantId) {
    reviewsQuery = reviewsQuery.eq('restaurant_id', restaurantId)
  }

  const { data, error } = await reviewsQuery
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to load reviews' })
  }
  const items = (data ?? []).map((x: any) => ({
    id: String(x.id),
    rating: Number(x.rating || 0),
    comment: typeof x.comment === 'string' ? x.comment : null,
    videoUrl: typeof x.video_url === 'string' ? x.video_url : null,
    publishedAt: String(x.published_at || x.created_at || ''),
  }))

  const ratingAgg = await computePublicRating(event, {
    shopId,
    restaurantId: restaurantId || null,
    sampleLimit: 20,
  })

  return {
    ok: true,
    moduleEnabled: true,
    items,
    rating: ratingAgg,
  }
})
