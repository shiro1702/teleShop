import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

interface LinkMaxBody {
  token?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LinkMaxBody>(event)
  if (!body?.token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: tokenRow, error: tokenError } = await serviceClient
    .from('auth_tokens')
    .select('*')
    .eq('token', body.token)
    .eq('channel', 'max')
    .maybeSingle()

  if (tokenError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check MAX token' })
  }
  if (!tokenRow) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid MAX token' })
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await serviceClient.from('auth_tokens').delete().eq('token', body.token)
    throw createError({ statusCode: 400, statusMessage: 'Token expired' })
  }

  return {
    success: true,
    maxUserId: tokenRow.max_user_id || null,
    maxConversationId: tokenRow.max_conversation_id || null,
  }
})
