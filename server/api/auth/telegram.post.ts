import crypto from 'node:crypto'
import { createSessionToken, type TelegramSessionUser } from '../../utils/session'

interface TelegramLoginPayload {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

const SESSION_COOKIE_NAME = 'tg_session'

function validateTelegramLogin(data: TelegramLoginPayload, botToken: string): TelegramSessionUser | null {
  const { hash, ...rest } = data

  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (expectedHash !== hash) return null

  const now = Math.floor(Date.now() / 1000)
  const authDate = Number(rest.auth_date)
  if (!Number.isFinite(authDate) || now - authDate > 60 * 5) {
    // более 5 минут считаем просроченным
    return null
  }

  return {
    id: rest.id,
    username: rest.username,
    firstName: rest.first_name ?? null,
    lastName: rest.last_name ?? null,
    photoUrl: rest.photo_url ?? null,
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botToken = config.botToken as string
  const sessionSecret = (config as any).sessionSecret as string | undefined

  if (!botToken || !sessionSecret) {
    console.error('[Auth][WEB] /api/auth/telegram: missing botToken or sessionSecret')
    throw createError({ statusCode: 500, message: 'Server config: bot token or session secret missing' })
  }

  const body = await readBody<TelegramLoginPayload | null>(event)
  if (!body || !body.id || !body.auth_date || !body.hash) {
    console.warn('[Auth][WEB] /api/auth/telegram: invalid payload shape', body)
    throw createError({ statusCode: 400, message: 'Invalid Telegram login payload' })
  }

  const user = validateTelegramLogin(body, botToken)
  if (!user) {
    console.warn('[Auth][WEB] /api/auth/telegram: hash/auth_date validation failed for id', body.id)
    throw createError({ statusCode: 401, message: 'Invalid Telegram login data' })
  }

  const token = createSessionToken(user, sessionSecret)
  console.log('[Auth][WEB] /api/auth/telegram: session created for user', {
    id: user.id,
    username: user.username,
  })

  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    path: '/',
  })

  return { ok: true, user }
})

