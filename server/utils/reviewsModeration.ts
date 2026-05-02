import { createError, type H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type ReviewAction = 'publish' | 'reject' | 'resolve' | 'reopen'

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`telegram_send_failed:${res.status}:${body}`)
  }
  const payload = await res.json()
  const messageId = payload?.result?.message_id
  return messageId != null ? String(messageId) : null
}

async function sendMax(baseUrl: string, token: string, conversationId: string, text: string): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`max_send_failed:${res.status}:${body}`)
  }
}

function getStatusPatch(action: ReviewAction): { status: string; publishedAt?: string | null; resolvedAt?: string | null } {
  if (action === 'publish') return { status: 'published', publishedAt: new Date().toISOString() }
  if (action === 'resolve') return { status: 'resolved', resolvedAt: new Date().toISOString() }
  if (action === 'reopen') return { status: 'manager_review', resolvedAt: null }
  return { status: 'rejected', publishedAt: null }
}

export async function sendReviewToManager(event: H3Event, reviewId: string): Promise<void> {
  const config = useRuntimeConfig(event)
  const client = await serverSupabaseServiceRole(event)
  const { data: review } = await client
    .from('shop_reviews')
    .select('id,shop_id,restaurant_id,order_id,rating,comment,video_url,moderation_channel,moderation_chat_id')
    .eq('id', reviewId)
    .maybeSingle()
  if (!review?.id) return

  const { data: shop } = await client.from('shops').select('name,telegram_bot_token').eq('id', (review as any).shop_id).maybeSingle()
  const { data: restaurant } = (review as any).restaurant_id
    ? await client.from('restaurants').select('name').eq('id', (review as any).restaurant_id).maybeSingle()
    : { data: null as any }
  const title = [
    '⚠️ Негативный отзыв',
    `🏪 ${String((shop as any)?.name || 'Ресторан')}`,
    `📍 Точка: ${String((restaurant as any)?.name || '—')}`,
    `🧾 Заказ: ${String((review as any).order_id || '—')}`,
    `⭐ Оценка: ${Number((review as any).rating || 0)}`,
    `💬 Комментарий: ${String((review as any).comment || '—')}`,
    `🎥 Видео: ${String((review as any).video_url || '—')}`,
  ].join('\n')

  const channel = String((review as any).moderation_channel || '')
  const chatId = String((review as any).moderation_chat_id || '')
  if (!channel || !chatId) return

  if (channel === 'telegram') {
    const botToken = String((shop as any)?.telegram_bot_token || config.botToken || '')
    if (!botToken) return
    const messageId = await sendTelegram(botToken, chatId, title)
    if (messageId) {
      await client
        .from('shop_reviews')
        .update({ moderation_message_id: messageId, forwarded_to_manager_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', reviewId)
    }
    return
  }

  if (channel === 'max') {
    const maxBaseUrl = String(config.maxApiBaseUrl || '')
    const maxToken = String(config.maxApiToken || '')
    if (!maxBaseUrl || !maxToken) return
    await sendMax(maxBaseUrl, maxToken, chatId, title)
    await client
      .from('shop_reviews')
      .update({ forwarded_to_manager_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', reviewId)
  }
}

export async function applyReviewModerationAction(event: H3Event, args: {
  reviewId: string
  shopId: string
  action: ReviewAction
  actorUserId: string
}): Promise<{ status: string }> {
  const client = await serverSupabaseServiceRole(event)
  const { data: review } = await client
    .from('shop_reviews')
    .select('id,shop_id,restaurant_id,status')
    .eq('id', args.reviewId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (!review?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const patch = getStatusPatch(args.action)
  const payload: Record<string, unknown> = {
    status: patch.status,
    updated_at: new Date().toISOString(),
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'publishedAt')) payload.published_at = patch.publishedAt || null
  if (Object.prototype.hasOwnProperty.call(patch, 'resolvedAt')) payload.resolved_at = patch.resolvedAt || null

  const { error: updateError } = await client
    .from('shop_reviews')
    .update(payload)
    .eq('id', args.reviewId)
    .eq('shop_id', args.shopId)
  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update review' })
  }

  await client.from('shop_review_events').insert({
    review_id: args.reviewId,
    shop_id: args.shopId,
    restaurant_id: (review as any).restaurant_id || null,
    action: args.action,
    action_payload: {},
    actor_channel: 'dashboard',
    actor_user_id: args.actorUserId,
  })

  return { status: patch.status }
}
