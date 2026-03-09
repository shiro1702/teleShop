import { getCookie } from 'h3'
import type { H3Event } from 'h3'
import { verifySessionToken, type TelegramSessionUser } from './session'

const SESSION_COOKIE_NAME = 'tg_session'

export async function getTelegramUserFromEvent(event: H3Event): Promise<TelegramSessionUser | null> {
  const config = useRuntimeConfig()
  const sessionSecret = (config as any).sessionSecret as string | undefined
  if (!sessionSecret) return null

  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) return null

  const payload = verifySessionToken(token, sessionSecret)
  if (!payload) return null

  return payload.user
}

