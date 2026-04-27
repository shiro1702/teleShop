import { createError, type H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

type ModerationAction =
  | 'approve_menu'
  | 'approve_feed'
  | 'approve_menu_and_feed'
  | 'tag_category'
  | 'reject'
  | 'forward_to_corner'
  | 'shadow_ban'

async function telegram(token: string, method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telegram ${method}: ${res.status} ${text}`)
  }
  return res.json()
}

async function sendMaxMessage(
  baseUrl: string,
  token: string,
  options: { text: string; conversationId?: string | null; attachments?: Array<Record<string, unknown>> },
): Promise<void> {
  if (!options.conversationId) return
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: options.conversationId,
      text: options.text,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MAX sendMessage: ${res.status} ${text}`)
  }
}

function statusPatchByAction(action: ModerationAction): {
  status: string
  publishToMenu: boolean
  publishToFeed: boolean
} {
  if (action === 'approve_menu') return { status: 'approved_menu', publishToMenu: true, publishToFeed: false }
  if (action === 'approve_feed') return { status: 'approved_feed', publishToMenu: false, publishToFeed: true }
  if (action === 'approve_menu_and_feed') return { status: 'approved_menu_and_feed', publishToMenu: true, publishToFeed: true }
  if (action === 'forward_to_corner') return { status: 'forwarded_to_corner', publishToMenu: false, publishToFeed: false }
  if (action === 'shadow_ban') return { status: 'shadow_banned', publishToMenu: false, publishToFeed: false }
  return { status: 'rejected', publishToMenu: false, publishToFeed: false }
}

export async function sendFestivalSubmissionToModeration(event: H3Event, submissionId: string): Promise<void> {
  const config = useRuntimeConfig(event)
  const client = await serverSupabaseServiceRole(event)
  const { data: submission } = await client
    .from('festival_ugc_submissions')
    .select('id,festival_id,shop_id,restaurant_id,order_id,kind,rating,category,media_url,moderation_channel,moderation_chat_id')
    .eq('id', submissionId)
    .maybeSingle()
  if (!submission?.id) return

  const { data: festival } = await client
    .from('festivals')
    .select('name,slug')
    .eq('id', (submission as any).festival_id)
    .maybeSingle()
  const { data: restaurant } = (submission as any).restaurant_id
    ? await client.from('restaurants').select('name').eq('id', (submission as any).restaurant_id).maybeSingle()
    : { data: null as any }

  const title = (submission as any).kind === 'story' ? 'Новая Live-сторис' : 'Новый видеоотзыв'
  const lines = [
    `🎬 ${title}`,
    `🎪 Фестиваль: ${String((festival as any)?.name || (festival as any)?.slug || 'festival')}`,
    `🏪 Корнер: ${String((restaurant as any)?.name || '—')}`,
    `🆔 Submission: ${String((submission as any).id)}`,
    `⭐ Рейтинг: ${Number((submission as any).rating || 0) || '—'}`,
    `🏷 Категория: ${String((submission as any).category || '—')}`,
  ]
  const text = lines.join('\n')

  const chatId = String((submission as any).moderation_chat_id || '')
  const tgToken = String((event.context?.tenant as any)?.telegramBotToken || config.botToken || '')
  const maxBaseUrl = String(config.maxApiBaseUrl || '')
  const maxToken = String(config.maxApiToken || '')
  if ((submission as any).moderation_channel === 'telegram' && chatId && tgToken) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔥 В меню', callback_data: `ugc:approve_menu:${submissionId}` },
          { text: '🌟 В меню + лента', callback_data: `ugc:approve_menu_and_feed:${submissionId}` },
        ],
        [
          { text: '🍔 Еда', callback_data: `ugc:tag_food:${submissionId}` },
          { text: '🎸 Сцена', callback_data: `ugc:tag_stage:${submissionId}` },
          { text: '👯 Вайб', callback_data: `ugc:tag_vibe:${submissionId}` },
        ],
        [
          { text: '✉️ Менеджеру', callback_data: `ugc:forward:${submissionId}` },
          { text: '❌ Отклонить', callback_data: `ugc:reject:${submissionId}` },
          { text: '🛑 Бан', callback_data: `ugc:ban:${submissionId}` },
        ],
      ],
    }
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      reply_markup: keyboard,
    }
    const mediaUrl = String((submission as any).media_url || '')
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)
    if (isVideo) {
      payload.video = mediaUrl
      payload.caption = text
      delete payload.text
      const res = await telegram(tgToken, 'sendVideo', payload)
      const msgId = (res as any)?.result?.message_id
      if (msgId) {
        await client.from('festival_ugc_submissions')
          .update({ moderation_message_id: String(msgId), updated_at: new Date().toISOString() })
          .eq('id', submissionId)
      }
      return
    }
    const res = await telegram(tgToken, 'sendMessage', payload)
    const msgId = (res as any)?.result?.message_id
    if (msgId) {
      await client.from('festival_ugc_submissions')
        .update({ moderation_message_id: String(msgId), updated_at: new Date().toISOString() })
        .eq('id', submissionId)
    }
    return
  }

  if ((submission as any).moderation_channel === 'max' && chatId && maxBaseUrl && maxToken) {
    const commandHint = [
      '',
      'Команды модерации:',
      `ugc approve_menu ${submissionId}`,
      `ugc approve_menu_and_feed ${submissionId}`,
      `ugc tag_food ${submissionId}`,
      `ugc tag_stage ${submissionId}`,
      `ugc tag_vibe ${submissionId}`,
      `ugc forward ${submissionId}`,
      `ugc reject ${submissionId}`,
      `ugc ban ${submissionId}`,
    ].join('\n')
    await sendMaxMessage(maxBaseUrl, maxToken, {
      conversationId: chatId,
      text: `${text}\n${commandHint}`,
    })
  }
}

export async function applyFestivalModerationAction(event: H3Event, args: {
  submissionId: string
  action: ModerationAction
  actorChannel: 'telegram' | 'max' | 'dashboard'
  actorUserId: string
  category?: 'live' | 'food' | 'stage' | 'vibe' | 'quest' | null
}): Promise<{ status: string }> {
  const config = useRuntimeConfig(event)
  const client = await serverSupabaseServiceRole(event)
  const { data: submission } = await client
    .from('festival_ugc_submissions')
    .select('id,festival_id,shop_id,restaurant_id,order_id,kind,rating,author_profile_id,author_telegram_id,author_max_user_id,media_url')
    .eq('id', args.submissionId)
    .maybeSingle()
  if (!submission?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  }

  if (args.action === 'tag_category') {
    const category = args.category || null
    const { error: tagError } = await client
      .from('festival_ugc_submissions')
      .update({ category, updated_at: new Date().toISOString() })
      .eq('id', args.submissionId)
    if (tagError) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to tag submission' })
    }
    await client.from('festival_ugc_moderation_events').insert({
      submission_id: args.submissionId,
      festival_id: (submission as any).festival_id,
      shop_id: (submission as any).shop_id,
      action: 'tag_category',
      action_payload: { category },
      actor_channel: args.actorChannel,
      actor_user_id: args.actorUserId,
    })
    return { status: 'pending' }
  }

  if (args.action === 'shadow_ban') {
    await client
      .from('festival_ugc_bans')
      .upsert({
        festival_id: (submission as any).festival_id,
        shop_id: (submission as any).shop_id,
        profile_id: (submission as any).author_profile_id || null,
        telegram_id: (submission as any).author_telegram_id || null,
        max_user_id: (submission as any).author_max_user_id || null,
        reason: 'moderator_shadow_ban',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'festival_id,shop_id,profile_id' })
  }

  const patch = statusPatchByAction(args.action)
  const updatePayload: Record<string, unknown> = {
    status: patch.status,
    publish_to_menu: patch.publishToMenu,
    publish_to_feed: patch.publishToFeed,
    updated_at: new Date().toISOString(),
  }
  if (args.action === 'forward_to_corner') {
    updatePayload.forwarded_to_restaurant_at = new Date().toISOString()
  }
  const { error: updateError } = await client
    .from('festival_ugc_submissions')
    .update(updatePayload)
    .eq('id', args.submissionId)
  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update submission status' })
  }

  await client.from('festival_ugc_moderation_events').insert({
    submission_id: args.submissionId,
    festival_id: (submission as any).festival_id,
    shop_id: (submission as any).shop_id,
    action: args.action,
    action_payload: {},
    actor_channel: args.actorChannel,
    actor_user_id: args.actorUserId,
  })

  if (args.action === 'forward_to_corner') {
    const { data: branch } = (submission as any).restaurant_id
      ? await client
        .from('restaurants')
        .select('name,manager_group_chat_id,manager_max_chat_id')
        .eq('id', (submission as any).restaurant_id)
        .maybeSingle()
      : { data: null as any }
    const { data: festival } = await client
      .from('festivals')
      .select('name')
      .eq('id', (submission as any).festival_id)
      .maybeSingle()
    const text = [
      '⚠️ Негативный UGC-отзыв',
      `🎪 Фестиваль: ${String((festival as any)?.name || 'festival')}`,
      `🏪 Корнер: ${String((branch as any)?.name || '—')}`,
      `🆔 Submission: ${args.submissionId}`,
      `⭐ Оценка: ${Number((submission as any).rating || 0) || '—'}`,
      'Пожалуйста, отработайте претензию с командой корнера.',
      `Медиа: ${String((submission as any).media_url || '—')}`,
    ].join('\n')
    const tgChat = typeof (branch as any)?.manager_group_chat_id === 'string' ? String((branch as any).manager_group_chat_id).trim() : ''
    const maxChat = typeof (branch as any)?.manager_max_chat_id === 'string' ? String((branch as any).manager_max_chat_id).trim() : ''
    const tgToken = String((event.context?.tenant as any)?.telegramBotToken || config.botToken || '')
    const maxBase = String(config.maxApiBaseUrl || '')
    const maxToken = String(config.maxApiToken || '')
    if (tgChat && tgToken) {
      await telegram(tgToken, 'sendMessage', { chat_id: tgChat, text }).catch(() => {})
    }
    if (maxChat && maxBase && maxToken) {
      await sendMaxMessage(maxBase, maxToken, { conversationId: maxChat, text }).catch(() => {})
    }
  }

  return { status: patch.status }
}
