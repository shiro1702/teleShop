import crypto from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

type TelegramUser = {
  id: number
}

function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (computedHash !== hash) return null

  const userStr = params.get('user')
  if (!userStr) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(userStr)) as TelegramUser
    return typeof parsed?.id === 'number' ? parsed : null
  } catch {
    return null
  }
}

export async function resolveCustomerProfileId(event: H3Event, botToken: string): Promise<string> {
  const supabaseUser = await serverSupabaseUser(event)
  if (supabaseUser) {
    const rawUser = supabaseUser as any
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : null
    if (userId) return userId
  }

  const initData = getHeader(event, 'x-telegram-init-data') || ''
  if (!initData.trim()) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const tgUser = validateInitData(initData, botToken)
  if (!tgUser) {
    throw createError({ statusCode: 401, message: 'Invalid initData' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: profile } = await client
    .from('profiles')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  if (!profile?.id) {
    throw createError({ statusCode: 401, message: 'Profile not found' })
  }

  return String(profile.id)
}
