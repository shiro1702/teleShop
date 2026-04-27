import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import {
  isCustomerBannedForFestival,
  loadEligibleFestivalOrders,
  resolveCustomerIdentityOrThrow,
  resolveFestivalOrThrow,
} from '~/server/utils/festivalUgc'
import { sendFestivalSubmissionToModeration } from '~/server/utils/festivalUgcModeration'

type Body = {
  kind?: 'story' | 'video_review'
  rating?: number | null
  category?: 'live' | 'food' | 'stage' | 'vibe' | 'quest' | null
  orderId?: string | null
  orderItemPayload?: Record<string, unknown> | null
  mediaUrl?: string
  mediaPath?: string | null
}

const CATEGORIES = new Set(['live', 'food', 'stage', 'vibe', 'quest'])

export default defineEventHandler(async (event) => {
  const festivalSlug = getRouterParam(event, 'festival_slug')
  if (!festivalSlug) {
    throw createError({ statusCode: 400, statusMessage: 'festival_slug is required' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const kind = body.kind === 'story' ? 'story' : 'video_review'
  const rating = typeof body.rating === 'number' ? Math.round(body.rating) : null
  if (kind === 'video_review' && (rating == null || rating < 1 || rating > 5)) {
    throw createError({ statusCode: 400, statusMessage: 'rating from 1 to 5 is required for video_review' })
  }
  if (!body.mediaUrl || !body.mediaUrl.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'mediaUrl is required' })
  }
  if (body.category && !CATEGORIES.has(body.category)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
  }

  const { shopId } = await requireTenantShop(event)
  const festival = await resolveFestivalOrThrow(event, festivalSlug)
  const identity = await resolveCustomerIdentityOrThrow(event)
  const client = await serverSupabaseServiceRole(event)

  const isBanned = await isCustomerBannedForFestival(client, {
    festivalId: festival.id,
    shopId,
    profileId: identity.profileId,
    telegramId: identity.telegramId,
    maxUserId: identity.maxUserId,
  })
  if (isBanned) {
    throw createError({ statusCode: 403, statusMessage: 'UGC is blocked for this account' })
  }

  const eligibleOrders = await loadEligibleFestivalOrders(client, {
    profileId: identity.profileId,
    festivalId: festival.id,
    shopId,
    limit: 50,
  })
  if (!eligibleOrders.length) {
    throw createError({ statusCode: 403, statusMessage: 'Purchase is required before posting' })
  }

  let selectedOrder = eligibleOrders[0]
  if (body.orderId) {
    const hit = eligibleOrders.find((x) => String(x.id) === body.orderId)
    if (!hit) {
      throw createError({ statusCode: 400, statusMessage: 'orderId is not eligible' })
    }
    selectedOrder = hit
  }
  if (kind === 'video_review' && !body.orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required for video_review' })
  }

  const { data: modChat } = await client
    .from('festival_moderation_chats')
    .select('telegram_chat_id,max_chat_id')
    .eq('festival_id', festival.id)
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .maybeSingle()

  const moderationChannel = (modChat as any)?.telegram_chat_id
    ? 'telegram'
    : (modChat as any)?.max_chat_id
      ? 'max'
      : null
  const moderationChatId = moderationChannel === 'telegram'
    ? String((modChat as any)?.telegram_chat_id || '')
    : moderationChannel === 'max'
      ? String((modChat as any)?.max_chat_id || '')
      : null

  const payload = {
    festival_id: festival.id,
    shop_id: shopId,
    restaurant_id: selectedOrder?.restaurant_id || null,
    order_id: kind === 'video_review' ? String(selectedOrder.id) : null,
    order_item_payload: body.orderItemPayload && typeof body.orderItemPayload === 'object' ? body.orderItemPayload : {},
    author_profile_id: identity.profileId,
    author_telegram_id: identity.telegramId,
    author_max_user_id: identity.maxUserId,
    kind,
    rating,
    category: body.category || null,
    media_url: body.mediaUrl.trim(),
    media_path: body.mediaPath?.trim() || null,
    status: 'pending',
    publish_to_menu: false,
    publish_to_feed: false,
    moderation_channel: moderationChannel,
    moderation_chat_id: moderationChatId,
  }

  const { data, error } = await client
    .from('festival_ugc_submissions')
    .insert(payload)
    .select('id,festival_id,shop_id,restaurant_id,order_id,kind,rating,category,status,created_at,moderation_channel,moderation_chat_id')
    .single()
  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to create review' })
  }

  await client.from('festival_ugc_moderation_events').insert({
    submission_id: data.id,
    festival_id: festival.id,
    shop_id: shopId,
    action: 'tag_category',
    action_payload: { initial: true, category: body.category || null, kind },
    actor_channel: 'dashboard',
    actor_user_id: identity.profileId,
  })
  await sendFestivalSubmissionToModeration(event, String(data.id)).catch((err) => {
    console.error('festival reviews: failed to send moderation message', err)
  })

  return { ok: true, item: data }
})
