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
 * Создаёт (или находит) profiles + auth.users для пользователя Telegram mini app,
 * чтобы customer_delivery_addresses работали без отдельного link-telegram.
 */
export async function ensureTelegramCustomerProfile(
  event: H3Event,
  telegramId: number,
): Promise<string | null> {
  if (!Number.isFinite(telegramId)) return null

  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: existingRows } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .limit(1)
  const existing = Array.isArray(existingRows) ? existingRows[0] : null
  if (existing?.id) return String(existing.id)

  const config = useRuntimeConfig()
  const syntheticEmail = `tg_${telegramId}@telegram.local`
  const secret = (config.sessionSecret as string) || 'telegram-session-secret'
  const syntheticPassword = crypto
    .createHash('sha256')
    .update(`${telegramId}:${secret}`)
    .digest('hex')

  let userId: string | null = await findAuthUserIdByEmail(serviceClient, syntheticEmail)

  if (!userId) {
    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: syntheticEmail,
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { telegram_id: telegramId },
    })
    if (createUserError || !createdUser?.user?.id) {
      const again = await findAuthUserIdByEmail(serviceClient, syntheticEmail)
      if (!again) {
        console.error('[ensureTelegramCustomerProfile] createUser failed', createUserError)
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
      telegram_id: telegramId,
    },
    { onConflict: 'id' },
  )
  if (upsertError) {
    console.error('[ensureTelegramCustomerProfile] profiles upsert failed', upsertError)
    const { data: raced } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle()
    return raced?.id ? String(raced.id) : null
  }

  await serviceClient.auth.admin.updateUserById(userId, {
    user_metadata: { telegram_id: telegramId },
  }).catch(() => {})

  return userId
}
