import { createError, type H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  type ReviewIdentity,
  resolveInitialReviewStatus,
  resolveManagerNotificationMode,
  sanitizeReviewComment,
  sanitizeVideoUrl,
} from '~/server/utils/reviews'
import { sendReviewToManager } from '~/server/utils/reviewsModeration'

export type OrderRowForReview = {
  id: string
  shop_id: string
  restaurant_id: string | null
}

async function resolveModeration(client: any, shopId: string, restaurantId: string | null) {
  const { data: scopedChannelRows } = restaurantId
    ? await client
      .from('shop_review_moderation_channels')
      .select('restaurant_id,telegram_chat_id,max_chat_id,is_active')
      .eq('shop_id', shopId)
      .eq('restaurant_id', restaurantId)
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
  return resolveManagerNotificationMode(directChannel || globalChannel || null)
}

export async function markReviewPromptsCompletedForOrder(
  client: any,
  orderId: string,
  reviewId: string,
): Promise<void> {
  const nowIso = new Date().toISOString()
  await client
    .from('shop_order_review_prompts')
    .update({
      status: 'completed',
      review_id: reviewId,
      updated_at: nowIso,
    })
    .eq('order_id', orderId)
    .in('status', ['awaiting_send', 'sent', 'send_failed'])
}

export async function insertShopReview(event: H3Event, args: {
  shopId: string
  order: OrderRowForReview
  identity: ReviewIdentity
  rating: number
  comment?: string | null
  videoUrl?: string | null
  actorChannel: 'telegram' | 'max' | 'system' | 'dashboard'
}): Promise<{ id: string; rating: number; status: string; published_at: string | null; created_at: string }> {
  const client = await serverSupabaseServiceRole(event)
  const rating = Math.round(args.rating)
  const status = resolveInitialReviewStatus(rating)
  const comment = sanitizeReviewComment(args.comment ?? null)
  const videoUrl = sanitizeVideoUrl(args.videoUrl ?? null)
  const moderation = await resolveModeration(client, args.shopId, args.order.restaurant_id)
  const nowIso = new Date().toISOString()
  const payload = {
    shop_id: args.shopId,
    restaurant_id: args.order.restaurant_id || null,
    order_id: args.order.id,
    profile_id: args.identity.profileId,
    customer_telegram_id: args.identity.telegramId,
    customer_max_user_id: args.identity.maxUserId,
    rating,
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
    shop_id: args.shopId,
    restaurant_id: args.order.restaurant_id || null,
    action: 'created',
    action_payload: { rating, hasComment: !!comment, hasVideo: !!videoUrl },
    actor_channel: args.actorChannel,
    actor_user_id: args.identity.profileId,
  })

  if (status === 'manager_review') {
    await client.from('shop_review_events').insert({
      review_id: review.id,
      shop_id: args.shopId,
      restaurant_id: args.order.restaurant_id || null,
      action: 'send_to_manager',
      action_payload: {},
      actor_channel: args.actorChannel,
      actor_user_id: args.identity.profileId,
    })
    await sendReviewToManager(event, String(review.id)).catch((err) => {
      console.error('reviews: send manager message failed', err)
    })
  }

  await markReviewPromptsCompletedForOrder(client, args.order.id, String(review.id)).catch((err) => {
    console.error('markReviewPromptsCompletedForOrder:', err)
  })

  return review as any
}

export async function updateShopReviewRating(event: H3Event, args: {
  shopId: string
  order: OrderRowForReview
  identity: ReviewIdentity
  rating: number
  actorChannel: 'telegram' | 'max' | 'system' | 'dashboard'
}): Promise<{ id: string; rating: number; status: string; published_at: string | null; created_at: string }> {
  const client = await serverSupabaseServiceRole(event)
  const rating = Math.round(args.rating)
  const { data: existing, error: loadErr } = await client
    .from('shop_reviews')
    .select('id,rating,status')
    .eq('order_id', args.order.id)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (loadErr) {
    throw createError({ statusCode: 500, statusMessage: loadErr.message || 'Failed to load review' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const nextStatus = resolveInitialReviewStatus(rating)
  const moderation = await resolveModeration(client, args.shopId, args.order.restaurant_id)
  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = {
    rating,
    status: nextStatus,
    moderation_channel: moderation.channel,
    moderation_chat_id: moderation.chatId,
    published_at: nextStatus === 'published' ? nowIso : null,
    updated_at: nowIso,
  }

  const { data: review, error } = await client
    .from('shop_reviews')
    .update(patch)
    .eq('id', (existing as any).id)
    .select('id,shop_id,restaurant_id,order_id,rating,status,published_at,created_at')
    .single()
  if (error || !review) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to update review' })
  }

  await client.from('shop_review_events').insert({
    review_id: (existing as any).id,
    shop_id: args.shopId,
    restaurant_id: args.order.restaurant_id || null,
    action: 'edit',
    action_payload: { fromRating: (existing as any).rating, toRating: rating, nextStatus },
    actor_channel: args.actorChannel,
    actor_user_id: args.identity.profileId,
  })

  const prevRating = Number((existing as any).rating)
  const prevStatus = String((existing as any).status || '')
  const shouldNotifyManager =
    rating <= 3 && (prevRating > 3 || prevStatus === 'published' || prevStatus === 'new')

  if (nextStatus === 'manager_review' && shouldNotifyManager) {
    await client.from('shop_review_events').insert({
      review_id: (existing as any).id,
      shop_id: args.shopId,
      restaurant_id: args.order.restaurant_id || null,
      action: 'send_to_manager',
      action_payload: { via: 'rating_update', prevRating, nextRating: rating },
      actor_channel: args.actorChannel,
      actor_user_id: args.identity.profileId,
    })
    await sendReviewToManager(event, String((existing as any).id)).catch((err) => {
      console.error('reviews: send manager message failed', err)
    })
  }

  await markReviewPromptsCompletedForOrder(client, args.order.id, String((existing as any).id)).catch((err) => {
    console.error('markReviewPromptsCompletedForOrder:', err)
  })

  return review as any
}
