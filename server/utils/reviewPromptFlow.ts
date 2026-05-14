import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { isShopFeatureEnabled } from '~/server/utils/features'
import type { NotificationEvent } from '~/server/utils/notifications'
import type { ReviewIdentity } from '~/server/utils/reviews'
import {
  reviewPromptPlainText,
  telegramChangeRatingRow,
  telegramStarKeyboardRows,
  maxStarLinkAttachments,
} from '~/server/utils/reviewPromptParse'
import { sendMax } from '~/server/utils/serviceCalls'
import { insertShopReview, updateShopReviewRating } from '~/server/utils/shopReviewWrite'

function newPublicToken(): string {
  return crypto.randomBytes(6).toString('hex').toLowerCase()
}

function formatOrderRefShort(orderNumber: unknown, orderId: string): string {
  const raw = typeof orderNumber === 'string' && orderNumber.trim() ? orderNumber.trim() : orderId.trim()
  const normalized = raw.replace(/\s+/g, '')
  const short = normalized.length > 8 ? normalized.slice(0, 8) : normalized
  return `#${short || '—'}`
}

export function resolveReviewPromptDelayMinutes(event: H3Event): number {
  const config = useRuntimeConfig(event)
  const raw = Number((config as any).reviewPromptDelayMinutes)
  if (!Number.isFinite(raw) || raw < 0) return 45
  return Math.min(24 * 60, Math.max(0, Math.floor(raw)))
}

export async function scheduleReviewPromptsAfterHanded(event: H3Event, input: NotificationEvent): Promise<void> {
  if (input.eventType !== 'ORDER_STATUS_CHANGED') return
  if (input.orderContext.status !== 'handed_to_customer') return

  const shopId = input.tenantContext.shopId
  const orderId = input.orderContext.orderId
  const enabled = await isShopFeatureEnabled(event, shopId, 'reputation_reviews_pro')
  if (!enabled) return

  const client = await serverSupabaseServiceRole(event)
  const { data: existingReview } = await client
    .from('shop_reviews')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existingReview?.id) return

  const { data: order } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,status,customer_telegram_id,customer_profile_id,order_number')
    .eq('id', orderId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (!order || String((order as any).status || '').toLowerCase() === 'cancelled') return

  const delayMin = resolveReviewPromptDelayMinutes(event)
  const scheduledFor = new Date(Date.now() + delayMin * 60 * 1000).toISOString()
  const expiresAt = new Date(Date.now() + (delayMin + 72 * 60) * 60 * 1000).toISOString()

  let customerMaxUserId = input.actorContext?.customerMaxUserId ?? null
  let maxConversationId = input.actorContext?.customerMaxConversationId ?? null
  const customerTelegramId =
    input.actorContext?.customerTelegramId != null && Number.isFinite(Number(input.actorContext.customerTelegramId))
      ? Number(input.actorContext.customerTelegramId)
      : null

  const profileId = (order as any).customer_profile_id ? String((order as any).customer_profile_id) : ''
  if (profileId && (!customerMaxUserId || !maxConversationId)) {
    const { data: profile } = await client
      .from('profiles')
      .select('max_user_id,max_conversation_id')
      .eq('id', profileId)
      .maybeSingle()
    if (!customerMaxUserId && typeof (profile as any)?.max_user_id === 'string' && (profile as any).max_user_id.trim()) {
      customerMaxUserId = String((profile as any).max_user_id).trim()
    }
    if (!maxConversationId && typeof (profile as any)?.max_conversation_id === 'string' && (profile as any).max_conversation_id.trim()) {
      maxConversationId = String((profile as any).max_conversation_id).trim()
    }
  }

  const rows: Array<Record<string, unknown>> = []
  if (customerTelegramId && customerTelegramId > 0) {
    rows.push({
      shop_id: shopId,
      order_id: orderId,
      restaurant_id: (order as any).restaurant_id || null,
      channel: 'telegram',
      public_token: newPublicToken(),
      status: 'awaiting_send',
      scheduled_for: scheduledFor,
      expires_at: expiresAt,
      trigger_kind: 'auto',
      customer_telegram_id: customerTelegramId,
      telegram_chat_id: String(customerTelegramId),
      customer_max_user_id: null,
      max_conversation_id: null,
    })
  }
  const hasMax = Boolean(
    (typeof customerMaxUserId === 'string' && customerMaxUserId.trim())
    || (typeof maxConversationId === 'string' && maxConversationId.trim()),
  )
  if (hasMax) {
    rows.push({
      shop_id: shopId,
      order_id: orderId,
      restaurant_id: (order as any).restaurant_id || null,
      channel: 'max',
      public_token: newPublicToken(),
      status: 'awaiting_send',
      scheduled_for: scheduledFor,
      expires_at: expiresAt,
      trigger_kind: 'auto',
      customer_telegram_id: null,
      telegram_chat_id: null,
      customer_max_user_id: typeof customerMaxUserId === 'string' && customerMaxUserId.trim() ? customerMaxUserId.trim() : null,
      max_conversation_id: typeof maxConversationId === 'string' && maxConversationId.trim() ? maxConversationId.trim() : null,
    })
  }

  for (const row of rows) {
    const { error } = await client.from('shop_order_review_prompts').insert(row)
    if (error && String(error.code) !== '23505') {
      console.error('scheduleReviewPromptsAfterHanded insert:', error)
    }
  }
}

export async function processDueReviewPrompts(event: H3Event, opts?: { limit?: number }): Promise<number> {
  const limit = Math.min(Math.max(Number(opts?.limit) || 20, 1), 100)
  const client = await serverSupabaseServiceRole(event)
  const nowIso = new Date().toISOString()
  const { data: due, error } = await client
    .from('shop_order_review_prompts')
    .select(
      'id,shop_id,order_id,restaurant_id,channel,public_token,status,scheduled_for,customer_telegram_id,telegram_chat_id,customer_max_user_id,max_conversation_id',
    )
    .eq('status', 'awaiting_send')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit)
  if (error || !due?.length) return 0

  let sent = 0
  for (const row of due as any[]) {
    const ok = await sendOneReviewPrompt(event, row).catch((e) => {
      console.error('sendOneReviewPrompt', e)
      return false
    })
    if (ok) sent += 1
  }
  return sent
}

async function sendOneReviewPrompt(event: H3Event, row: any): Promise<boolean> {
  const client = await serverSupabaseServiceRole(event)
  const promptId = String(row.id)
  const shopId = String(row.shop_id)
  const orderId = String(row.order_id)

  const { data: reviewExists } = await client.from('shop_reviews').select('id').eq('order_id', orderId).maybeSingle()
  if (reviewExists?.id) {
    await client
      .from('shop_order_review_prompts')
      .update({ status: 'completed', review_id: String((reviewExists as any).id), updated_at: new Date().toISOString() })
      .eq('id', promptId)
    return true
  }

  const { data: order } = await client
    .from('orders')
    .select('id,status,order_number')
    .eq('id', orderId)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (!order || String((order as any).status || '').toLowerCase() === 'cancelled') {
    await client
      .from('shop_order_review_prompts')
      .update({ status: 'expired', updated_at: new Date().toISOString(), last_error: 'order_cancelled_or_missing' })
      .eq('id', promptId)
    return true
  }

  const enabled = await isShopFeatureEnabled(event, shopId, 'reputation_reviews_pro')
  if (!enabled) {
    await client
      .from('shop_order_review_prompts')
      .update({ status: 'expired', updated_at: new Date().toISOString(), last_error: 'feature_disabled' })
      .eq('id', promptId)
    return true
  }

  const orderRef = formatOrderRefShort((order as any).order_number, orderId)
  const text = reviewPromptPlainText(orderRef)
  const token = String(row.public_token || '').toLowerCase()
  const nowIso = new Date().toISOString()

  if (row.channel === 'telegram') {
    const { data: shop } = await client.from('shops').select('telegram_bot_token').eq('id', shopId).maybeSingle()
    const config = useRuntimeConfig(event)
    const botToken = String((shop as any)?.telegram_bot_token || (config as any).botToken || '').trim()
    const chatId = String(row.telegram_chat_id || row.customer_telegram_id || '').trim()
    if (!botToken || !chatId) {
      await client
        .from('shop_order_review_prompts')
        .update({ status: 'send_failed', last_error: 'missing_telegram_target', updated_at: nowIso })
        .eq('id', promptId)
      return true
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: { inline_keyboard: telegramStarKeyboardRows(token) },
        }),
      })
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; result?: { message_id?: number } }
      if (!res.ok || !payload?.ok) {
        throw new Error(`telegram_send_failed:${res.status}`)
      }
      const messageId = payload?.result?.message_id != null ? String(payload.result.message_id) : null
      await client
        .from('shop_order_review_prompts')
        .update({
          status: 'sent',
          sent_at: nowIso,
          telegram_message_id: messageId,
          last_error: null,
          updated_at: nowIso,
        })
        .eq('id', promptId)
      return true
    } catch (e: any) {
      await client
        .from('shop_order_review_prompts')
        .update({
          status: 'send_failed',
          last_error: String(e?.message || 'telegram_error').slice(0, 500),
          updated_at: nowIso,
        })
        .eq('id', promptId)
      return true
    }
  }

  if (row.channel === 'max') {
    const config = useRuntimeConfig(event)
    const maxBaseUrl = String((config as any).maxApiBaseUrl || '').trim()
    const maxToken = String((config as any).maxApiToken || '').trim()
    const maxBotUrl = String((config.public as any)?.maxBotUrl || '').trim()
    if (!maxBaseUrl || !maxToken || !maxBotUrl) {
      await client
        .from('shop_order_review_prompts')
        .update({ status: 'send_failed', last_error: 'max_not_configured', updated_at: nowIso })
        .eq('id', promptId)
      return true
    }
    const userId = typeof row.customer_max_user_id === 'string' && row.customer_max_user_id.trim() ? row.customer_max_user_id.trim() : null
    const conversationId =
      typeof row.max_conversation_id === 'string' && row.max_conversation_id.trim() ? row.max_conversation_id.trim() : null
    try {
      await sendMax(maxBaseUrl, maxToken, {
        text,
        userId: conversationId ? undefined : userId || undefined,
        conversationId: conversationId || undefined,
        attachments: maxStarLinkAttachments(maxBotUrl, orderId),
      })
      await client
        .from('shop_order_review_prompts')
        .update({
          status: 'sent',
          sent_at: nowIso,
          last_error: null,
          updated_at: nowIso,
        })
        .eq('id', promptId)
      return true
    } catch (e: any) {
      await client
        .from('shop_order_review_prompts')
        .update({
          status: 'send_failed',
          last_error: String(e?.message || 'max_error').slice(0, 500),
          updated_at: nowIso,
        })
        .eq('id', promptId)
      return true
    }
  }

  return false
}

export async function enqueueManualReviewPrompts(
  event: H3Event,
  args: { shopId: string; orderId: string; actorProfileId: string },
): Promise<{ created: number }> {
  const client = await serverSupabaseServiceRole(event)
  const enabled = await isShopFeatureEnabled(event, args.shopId, 'reputation_reviews_pro')
  if (!enabled) {
    throw new Error('feature_disabled')
  }
  const { data: reviewExists } = await client.from('shop_reviews').select('id').eq('order_id', args.orderId).maybeSingle()
  if (reviewExists?.id) return { created: 0 }

  const { data: order } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,customer_telegram_id,customer_profile_id,order_number,status')
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (!order) throw new Error('order_not_found')

  let customerMaxUserId: string | null = null
  let maxConversationId: string | null = null
  const profileId = (order as any).customer_profile_id ? String((order as any).customer_profile_id) : ''
  if (profileId) {
    const { data: profile } = await client
      .from('profiles')
      .select('max_user_id,max_conversation_id')
      .eq('id', profileId)
      .maybeSingle()
    customerMaxUserId =
      typeof (profile as any)?.max_user_id === 'string' && (profile as any).max_user_id.trim()
        ? String((profile as any).max_user_id).trim()
        : null
    maxConversationId =
      typeof (profile as any)?.max_conversation_id === 'string' && (profile as any).max_conversation_id.trim()
        ? String((profile as any).max_conversation_id).trim()
        : null
  }

  const customerTelegramIdRaw = Number((order as any).customer_telegram_id)
  const customerTelegramId = Number.isFinite(customerTelegramIdRaw) && customerTelegramIdRaw > 0 ? customerTelegramIdRaw : null

  const scheduledFor = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  let created = 0

  const upsertChannel = async (payload: Record<string, unknown>) => {
    const channel = String(payload.channel)
    const { data: existingRow } = await client
      .from('shop_order_review_prompts')
      .select('id,status')
      .eq('order_id', args.orderId)
      .eq('channel', channel)
      .maybeSingle()
    if (existingRow?.id && String((existingRow as any).status) !== 'completed') {
      const { error: upErr } = await client
        .from('shop_order_review_prompts')
        .update({
          public_token: newPublicToken(),
          status: 'awaiting_send',
          scheduled_for: scheduledFor,
          expires_at: expiresAt,
          trigger_kind: 'manual',
          created_by_profile_id: args.actorProfileId,
          last_error: null,
          telegram_message_id: null,
          max_message_id: null,
          sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', String((existingRow as any).id))
      if (!upErr) created += 1
      return
    }
    if (existingRow?.id) return
    const { error } = await client.from('shop_order_review_prompts').insert(payload)
    if (!error) created += 1
  }

  if (customerTelegramId) {
    await upsertChannel({
      shop_id: args.shopId,
      order_id: args.orderId,
      restaurant_id: (order as any).restaurant_id || null,
      channel: 'telegram',
      public_token: newPublicToken(),
      status: 'awaiting_send',
      scheduled_for: scheduledFor,
      expires_at: expiresAt,
      trigger_kind: 'manual',
      created_by_profile_id: args.actorProfileId,
      customer_telegram_id: customerTelegramId,
      telegram_chat_id: String(customerTelegramId),
      customer_max_user_id: null,
      max_conversation_id: null,
    })
  }
  if (customerMaxUserId || maxConversationId) {
    await upsertChannel({
      shop_id: args.shopId,
      order_id: args.orderId,
      restaurant_id: (order as any).restaurant_id || null,
      channel: 'max',
      public_token: newPublicToken(),
      status: 'awaiting_send',
      scheduled_for: scheduledFor,
      expires_at: expiresAt,
      trigger_kind: 'manual',
      created_by_profile_id: args.actorProfileId,
      customer_telegram_id: null,
      telegram_chat_id: null,
      customer_max_user_id: customerMaxUserId,
      max_conversation_id: maxConversationId,
    })
  }

  await processDueReviewPrompts(event, { limit: 10 })
  return { created }
}

export async function applyReviewPromptTelegramCallback(event: H3Event, args: {
  shopId: string
  botToken: string
  telegramUserId: number
  chatId: number
  messageId: number
  token: string
  action: 'rate' | 'edit'
  stars?: number
}): Promise<void> {
  const client = await serverSupabaseServiceRole(event)
  const { data: prompt } = await client
    .from('shop_order_review_prompts')
    .select(
      'id,shop_id,order_id,restaurant_id,channel,public_token,status,customer_telegram_id,telegram_message_id',
    )
    .eq('public_token', args.token.toLowerCase())
    .eq('channel', 'telegram')
    .maybeSingle()
  if (!prompt?.id || String((prompt as any).shop_id) !== args.shopId) {
    throw new Error('prompt_not_found')
  }
  if (Number((prompt as any).customer_telegram_id) !== args.telegramUserId) {
    throw new Error('forbidden')
  }
  const orderId = String((prompt as any).order_id)
  const { data: order } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,customer_profile_id,customer_telegram_id')
    .eq('id', orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (!order) throw new Error('order_not_found')

  const identity: ReviewIdentity = {
    profileId: (order as any).customer_profile_id ? String((order as any).customer_profile_id) : null,
    telegramId: args.telegramUserId,
    maxUserId: null,
  }

  if (args.action === 'edit') {
    const keyboardToken = String((prompt as any).public_token).toLowerCase()
    const text = reviewPromptPlainText(formatOrderRefShort(null, orderId))
    await fetch(`https://api.telegram.org/bot${args.botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: args.chatId,
        message_id: args.messageId,
        text,
        reply_markup: { inline_keyboard: telegramStarKeyboardRows(keyboardToken) },
      }),
    }).catch(() => {})
    return
  }

  const stars = Number(args.stars)
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) throw new Error('bad_rating')

  const { data: existing } = await client.from('shop_reviews').select('id').eq('order_id', orderId).maybeSingle()
  const orderRow = {
    id: String((order as any).id),
    shop_id: String((order as any).shop_id),
    restaurant_id: (order as any).restaurant_id ? String((order as any).restaurant_id) : null,
  }

  let reviewId = ''
  if (existing?.id) {
    const updated = await updateShopReviewRating(event, {
      shopId: args.shopId,
      order: orderRow,
      identity,
      rating: stars,
      actorChannel: 'telegram',
    })
    reviewId = String((updated as any).id)
  } else {
    const created = await insertShopReview(event, {
      shopId: args.shopId,
      order: orderRow,
      identity,
      rating: stars,
      comment: null,
      videoUrl: null,
      actorChannel: 'telegram',
    })
    reviewId = String((created as any).id)
  }

  const ratedText = `Спасибо! Ваша оценка: ${stars} из 5.`
  await fetch(`https://api.telegram.org/bot${args.botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: args.chatId,
      message_id: args.messageId,
      text: ratedText,
      reply_markup: { inline_keyboard: telegramChangeRatingRow(String((prompt as any).public_token).toLowerCase()) },
    }),
  }).catch(() => {})

  await client
    .from('shop_order_review_prompts')
    .update({
      status: 'completed',
      review_id: reviewId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', String((prompt as any).id))
}
