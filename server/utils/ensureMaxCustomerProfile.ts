import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import crypto from 'node:crypto'

type ServiceClient = Awaited<ReturnType<typeof serverSupabaseServiceRole>>

async function findAuthUserIdByEmail(serviceClient: ServiceClient, email: string): Promise<string | null> {
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users ?? []
    const hit = users.find((user) => (user.email || '').toLowerCase() === email.toLowerCase())
    if (hit?.id) return hit.id
    if (users.length < perPage) break
    page += 1
  }
  return null
}

/**
 * Создаёт (или находит) profiles + auth.users для пользователя MAX mini app,
 * чтобы customer_delivery_addresses и прочие API могли работать без отдельного link-max.
 */
export async function ensureMaxCustomerProfile(
  event: H3Event,
  maxUserId: string,
  maxConversationId?: string | null,
): Promise<string | null> {
  const id = String(maxUserId || '').trim()
  if (!id) return null

  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: existing } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('max_user_id', id)
    .maybeSingle()
  if (existing?.id) return String(existing.id)

  const config = useRuntimeConfig()
  const syntheticEmail = `max_${id.replace(/[^a-zA-Z0-9._-]/g, '_')}@max.local`
  const secret = (config.sessionSecret as string) || 'max-session-secret'
  const syntheticPassword = crypto.createHash('sha256').update(`${id}:${secret}`).digest('hex')
  const conv = typeof maxConversationId === 'string' && maxConversationId.trim() ? maxConversationId.trim() : null

  let userId: string | null = await findAuthUserIdByEmail(serviceClient, syntheticEmail)

  if (!userId) {
    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { max_user_id: id },
    })
    if (createUserError || !createdUser?.user?.id) {
      const again = await findAuthUserIdByEmail(serviceClient, syntheticEmail)
      if (!again) {
        console.error('[ensureMaxCustomerProfile] createUser failed', createUserError)
        return null
      }
      userId = again
    } else {
      userId = createdUser.user.id
    }
  }

  const { error: upsertError } = await serviceClient.from('profiles').upsert(
    {
      id: userId,
      max_user_id: id,
      max_conversation_id: conv,
    },
    { onConflict: 'id' },
  )
  if (upsertError) {
    console.error('[ensureMaxCustomerProfile] profiles upsert failed', upsertError)
    const { data: raced } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('max_user_id', id)
      .maybeSingle()
    return raced?.id ? String(raced.id) : null
  }

  await serviceClient.auth.admin.updateUserById(userId, {
    user_metadata: { max_user_id: id, ...(conv ? { max_conversation_id: conv } : {}) },
  }).catch(() => {})

  return userId
}
