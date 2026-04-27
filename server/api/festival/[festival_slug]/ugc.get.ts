import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolveFestivalOrThrow } from '~/server/utils/festivalUgc'

type FeedCategory = 'all' | 'live' | 'food' | 'stage' | 'vibe' | 'quest'

export default defineEventHandler(async (event) => {
  const festivalSlug = getRouterParam(event, 'festival_slug')
  if (!festivalSlug) {
    throw createError({ statusCode: 400, statusMessage: 'festival_slug is required' })
  }

  const query = getQuery(event)
  const category = typeof query.category === 'string' && query.category.trim()
    ? query.category.trim().toLowerCase()
    : 'all'
  const limit = Math.min(Math.max(Number(query.limit) || 40, 1), 100)
  const shopId = typeof query.shop_id === 'string' && query.shop_id.trim() ? query.shop_id.trim() : null

  const festival = await resolveFestivalOrThrow(event, festivalSlug)
  const client = await serverSupabaseServiceRole(event)

  let dbQuery = client
    .from('festival_ugc_submissions')
    .select('id,shop_id,restaurant_id,order_id,kind,rating,category,media_url,order_item_payload,status,publish_to_menu,publish_to_feed,created_at')
    .eq('festival_id', festival.id)
    .in('status', ['approved_feed', 'approved_menu_and_feed'])
    .eq('publish_to_feed', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (shopId) {
    dbQuery = dbQuery.eq('shop_id', shopId)
  }
  if (category !== 'all') {
    dbQuery = dbQuery.eq('category', category as Exclude<FeedCategory, 'all'>)
  }

  const { data, error } = await dbQuery
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load festival UGC feed' })
  }

  const items = (data ?? []).map((x: any) => ({
    id: String(x.id),
    kind: x.kind === 'story' ? 'story' : 'video_review',
    rating: typeof x.rating === 'number' ? x.rating : null,
    category: x.category || null,
    mediaUrl: String(x.media_url || ''),
    orderItemPayload: x.order_item_payload && typeof x.order_item_payload === 'object' ? x.order_item_payload : {},
    shopId: String(x.shop_id || ''),
    restaurantId: x.restaurant_id ? String(x.restaurant_id) : null,
    orderId: x.order_id ? String(x.order_id) : null,
    createdAt: String(x.created_at || ''),
  }))

  return {
    ok: true,
    festivalId: festival.id,
    category,
    items,
  }
})
