import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  festivalId?: string
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!response.ok) {
    throw new Error(`telegram_send_failed:${response.status}`)
  }
}

async function sendMax(baseUrl: string, token: string, conversationId: string, text: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversationId, text }),
  })
  if (!response.ok) {
    throw new Error(`max_send_failed:${response.status}`)
  }
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can send test messages' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const festivalId = body.festivalId?.trim()
  if (!festivalId) {
    throw createError({ statusCode: 400, statusMessage: 'festivalId is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: row } = await client
    .from('festival_moderation_chats')
    .select('telegram_chat_id,max_chat_id')
    .eq('shop_id', access.shopId)
    .eq('festival_id', festivalId)
    .eq('is_active', true)
    .maybeSingle()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Festival moderation chat is not configured' })
  }

  const config = useRuntimeConfig(event)
  const tenant = event.context.tenant as { telegramBotToken?: string } | undefined
  const botToken =
    typeof tenant?.telegramBotToken === 'string' && tenant.telegramBotToken.trim()
      ? tenant.telegramBotToken.trim()
      : String(config.botToken || '')
  const maxBaseUrl = String(config.maxApiBaseUrl || '')
  const maxToken = String(config.maxApiToken || '')
  const text = '🧪 Festival UGC moderation test: чат подключен и готов к апрувам.'

  const sent: Array<'telegram' | 'max'> = []
  if (row.telegram_chat_id && botToken) {
    await sendTelegram(botToken, String(row.telegram_chat_id), text)
    sent.push('telegram')
  }
  if (row.max_chat_id && maxBaseUrl && maxToken) {
    await sendMax(maxBaseUrl, maxToken, String(row.max_chat_id), text)
    sent.push('max')
  }
  if (!sent.length) {
    throw createError({ statusCode: 400, statusMessage: 'No available transport to send test message' })
  }
  return { ok: true, sent }
})
