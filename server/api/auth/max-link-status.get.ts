import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token.trim() : ''
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'token is required' })
  }

  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: row, error } = await serviceClient
    .from('auth_tokens')
    .select('max_user_id, expires_at, channel')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('max-link-status query failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to check token' })
  }

  if (!row) {
    return { ok: true, state: 'invalid' as const }
  }

  if (String((row as { channel?: string }).channel || '') !== 'max') {
    return { ok: true, state: 'invalid' as const }
  }

  const now = Date.now()
  const expiresAt = new Date(String((row as { expires_at?: string }).expires_at)).getTime()
  if (Number.isFinite(expiresAt) && expiresAt < now) {
    await serviceClient.from('auth_tokens').delete().eq('token', token)
    return { ok: true, state: 'expired' as const }
  }

  const maxUser = (row as { max_user_id?: string | null }).max_user_id
  if (maxUser != null && String(maxUser).trim() !== '') {
    return { ok: true, state: 'ready' as const }
  }

  return { ok: true, state: 'pending' as const }
})
