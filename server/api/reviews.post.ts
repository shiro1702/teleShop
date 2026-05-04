import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import {
  requireOwnedOrderForReview,
  requireReviewsFeature,
  resolveInitialReviewStatus,
  resolveManagerNotificationMode,
  resolveReviewIdentity,
  sanitizeReviewComment,
  sanitizeVideoUrl,
} from '~/server/utils/reviews'
import { sendReviewToManager } from '~/server/utils/reviewsModeration'

type Body = {
  orderId?: string
  rating?: number
  comment?: string | null
  videoUrl?: string | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => ({}))
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const rating = Number(body.rating || 0)
  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'rating from 1 to 5 is required' })
  }

  const { shopId } = await requireTenantShop(event)
  await requireReviewsFeature(event, shopId)
  const identity = await resolveReviewIdentity(event)
  const order = await requireOwnedOrderForReview(event, { shopId, orderId, identity })
  const client = await serverSupabaseServiceRole(event)

  const status = resolveInitialReviewStatus(Math.round(rating))
  const comment = sanitizeReviewComment(body.comment)
  const videoUrl = sanitizeVideoUrl(body.videoUrl)

  const { data: scopedChannelRows } = order.restaurant_id
    ? await client
      .from('shop_review_moderation_channels')
      .select('restaurant_id,telegram_chat_id,max_chat_id,is_active')
      .eq('shop_id', shopId)
      .eq('restaurant_id', order.restaurant_id)
      .eq('is_active', true)
      .limit(1)
    : { data: [] as any[] }
  const { data: globalChannelRows } = await client
    .from('shop_review_moderation_channels')
    .select('restaurant_id,telegram_chat_id,max_chat_id,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .is('restaurant_id', null)
    .limit(1)
  const directChannel = (scopedChannelRows ?? [])[0]
  const globalChannel = (globalChannelRows ?? [])[0]
  const moderation = resolveManagerNotificationMode(directChannel || globalChannel || null)

  const nowIso = new Date().toISOString()
  const payload = {
    shop_id: shopId,
    restaurant_id: order.restaurant_id || null,
    order_id: order.id,
    profile_id: identity.profileId,
    customer_telegram_id: identity.telegramId,
    customer_max_user_id: identity.maxUserId,
    rating: Math.round(rating),
    comment,
    video_url: videoUrl,
    status,
    moderation_channel: moderation.channel,
    moderation_chat_id: moderation.chatId,
    published_at: status === 'published' ? nowIso : null,
  }

  const { data: review, error } = await client
    .from('shop_reviews')
    .insert(payload)
    .select('id,shop_id,restaurant_id,order_id,rating,status,published_at,created_at')
    .single()
  if (error || !review) {
    if (error?.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Review for this order already exists' })
    }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to create review' })
  }

  await client.from('shop_review_events').insert({
    review_id: review.id,
    shop_id: shopId,
    restaurant_id: order.restaurant_id || null,
    action: 'created',
    action_payload: { rating: Math.round(rating), hasComment: !!comment, hasVideo: !!videoUrl },
    actor_channel: 'system',
    actor_user_id: identity.profileId,
  })

  if (status === 'manager_review') {
    await client.from('shop_review_events').insert({
      review_id: review.id,
      shop_id: shopId,
      restaurant_id: order.restaurant_id || null,
      action: 'send_to_manager',
      action_payload: {},
      actor_channel: 'system',
      actor_user_id: identity.profileId,
    })
    await sendReviewToManager(event, String(review.id)).catch((err) => {
      console.error('reviews: send manager message failed', err)
    })
  }

  return { ok: true, item: review }
})
