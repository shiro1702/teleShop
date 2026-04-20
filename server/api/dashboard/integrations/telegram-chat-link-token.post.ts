import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  restaurantId?: string
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can create chat link tokens' })
  }

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : ''
  if (!restaurantId) {
    throw createError({ statusCode: 400, statusMessage: 'restaurantId is required' })
  }

  const config = useRuntimeConfig(event)
  const botNameRaw = typeof config.public?.telegramBotName === 'string' ? config.public.telegramBotName.trim() : ''
  const botName = botNameRaw.replace(/^@/, '')
  if (!botName) {
    throw createError({ statusCode: 500, statusMessage: 'telegramBotName is not configured' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: restaurant } = await client
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (!restaurant) {
    throw createError({ statusCode: 404, statusMessage: 'Restaurant not found' })
  }

  const token = randomUUID()
  const ttlMs = 10 * 60 * 1000
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  const { error } = await client
    .from('telegram_chat_link_tokens')
    .insert({
      shop_id: access.shopId,
      restaurant_id: restaurantId,
      token,
      created_by: access.userId,
      expires_at: expiresAt,
    })
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create link token' })
  }

  return {
    ok: true,
    token,
    tokenExpiresAt: expiresAt,
    deepLink: `https://t.me/${botName}?start=linkchat_${token}`,
    bindCommand: `/bind ${token}`,
  }
})
