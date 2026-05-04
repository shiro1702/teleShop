import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { requireReviewsFeature } from '~/server/utils/reviews'
import { computeInternalQualityScore, computePublicRating } from '~/server/utils/reviewsAggregation'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  await requireReviewsFeature(event, access.shopId)
  const query = getQuery(event)
  const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim() : 'all'
  const restaurantId = typeof query.restaurant_id === 'string' && query.restaurant_id.trim() ? query.restaurant_id.trim() : ''
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 300)
  const onlyNegative = String(query.only_negative || '').trim() === '1'

  const client = await serverSupabaseServiceRole(event)
  let dbQuery = client
    .from('shop_reviews')
    .select('id,shop_id,restaurant_id,order_id,rating,comment,video_url,status,moderation_channel,moderation_chat_id,forwarded_to_manager_at,published_at,resolved_at,created_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') dbQuery = dbQuery.eq('status', status)
  if (restaurantId) dbQuery = dbQuery.eq('restaurant_id', restaurantId)
  if (onlyNegative) dbQuery = dbQuery.lte('rating', 3)

  const { data, error } = await dbQuery
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to load reviews queue' })
  }
  const restaurantIds = Array.from(new Set((data ?? []).map((x: any) => String(x.restaurant_id || '')).filter(Boolean)))
  const { data: restaurants } = restaurantIds.length
    ? await client.from('restaurants').select('id,name').in('id', restaurantIds)
    : { data: [] as any[] }
  const restaurantById = new Map((restaurants ?? []).map((x: any) => [String(x.id), String(x.name || '—')]))

  const items = (data ?? []).map((x: any) => ({
    id: String(x.id),
    restaurantId: x.restaurant_id ? String(x.restaurant_id) : null,
    restaurantName: x.restaurant_id ? restaurantById.get(String(x.restaurant_id)) || '—' : '—',
    orderId: String(x.order_id || ''),
    rating: Number(x.rating || 0),
    comment: typeof x.comment === 'string' ? x.comment : null,
    videoUrl: typeof x.video_url === 'string' ? x.video_url : null,
    status: String(x.status || 'new'),
    moderationChannel: x.moderation_channel || null,
    moderationChatId: x.moderation_chat_id || null,
    forwardedToManagerAt: x.forwarded_to_manager_at || null,
    publishedAt: x.published_at || null,
    resolvedAt: x.resolved_at || null,
    createdAt: String(x.created_at || ''),
  }))

  const publicAgg = await computePublicRating(event, {
    shopId: access.shopId,
    restaurantId: restaurantId || null,
    sampleLimit: 20,
  })
  const internalAgg = await computeInternalQualityScore(event, {
    shopId: access.shopId,
    restaurantId: restaurantId || null,
    sampleLimit: 20,
  })

  let negBase = client
    .from('shop_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', access.shopId)
    .lte('rating', 3)
  if (restaurantId) negBase = negBase.eq('restaurant_id', restaurantId)

  let negResolved = client
    .from('shop_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', access.shopId)
    .lte('rating', 3)
    .eq('status', 'resolved')
  if (restaurantId) negResolved = negResolved.eq('restaurant_id', restaurantId)

  const [{ count: negativeTotal }, { count: resolvedNegative }] = await Promise.all([negBase, negResolved])

  const negativeTotalN = typeof negativeTotal === 'number' ? negativeTotal : 0
  const resolvedNegativeN = typeof resolvedNegative === 'number' ? resolvedNegative : 0

  return {
    ok: true,
    items,
    metrics: {
      public_rating: publicAgg.public_rating,
      public_sample_count: publicAgg.sample_count,
      internal_quality_score: internalAgg.internal_quality_score,
      internal_sample_count: internalAgg.sample_count,
      negative_total: negativeTotalN,
      negative_resolved: resolvedNegativeN,
      negative_resolved_percent: negativeTotalN > 0 ? Math.round((resolvedNegativeN / negativeTotalN) * 100) : 0,
    },
  }
})
