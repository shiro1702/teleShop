import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getHeader } from 'h3'

export type WebAppInitUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

/** initData из заголовка (алиас MAX или legacy Telegram). */
export function getMessengerInitDataFromEvent(event: H3Event): string {
  const a = getHeader(event, 'x-messenger-init-data')
  const b = getHeader(event, 'x-telegram-init-data')
  const fromA = typeof a === 'string' ? a.trim() : ''
  const fromB = typeof b === 'string' ? b.trim() : ''
  return fromA || fromB
}

/** Подпись WebAppData (Telegram и MAX используют тот же алгоритм). */
export function validateWebAppInitData(initData: string, botToken: string): WebAppInitUser | null {
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
    return JSON.parse(decodeURIComponent(userStr)) as WebAppInitUser
  } catch {
    return null
  }
}

export function getMaxBotTokenForShop(
  integrationKeys: Record<string, unknown> | null | undefined,
  config: { maxMiniAppBotToken?: string; maxApiToken?: string },
): string {
  const raw =
    integrationKeys && typeof integrationKeys.max_bot_token === 'string'
      ? integrationKeys.max_bot_token.trim()
      : ''
  if (raw) return raw
  const mini = typeof config.maxMiniAppBotToken === 'string' ? config.maxMiniAppBotToken.trim() : ''
  if (mini) return mini
  return typeof config.maxApiToken === 'string' ? config.maxApiToken.trim() : ''
}
