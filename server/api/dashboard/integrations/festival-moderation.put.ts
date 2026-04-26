import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  festivalId?: string
  telegramChatId?: string
  maxChatId?: string
  isActive?: boolean
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can update festival moderation settings' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const festivalId = body.festivalId?.trim()
  if (!festivalId) {
    throw createError({ statusCode: 400, statusMessage: 'festivalId is required' })
  }
  const telegramChatId = body.telegramChatId?.trim() || null
  const maxChatId = body.maxChatId?.trim() || null
  const isActive = body.isActive !== false
  if (!telegramChatId && !maxChatId) {
    throw createError({ statusCode: 400, statusMessage: 'At least one chat id is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: festival } = await client
    .from('festivals')
    .select('id')
    .eq('id', festivalId)
    .maybeSingle()
  if (!festival?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Festival not found' })
  }

  const { error } = await client
    .from('festival_moderation_chats')
    .upsert({
      festival_id: festivalId,
      shop_id: access.shopId,
      telegram_chat_id: telegramChatId,
      max_chat_id: maxChatId,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'festival_id,shop_id' })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to save festival moderation settings' })
  }

  return { ok: true }
})
