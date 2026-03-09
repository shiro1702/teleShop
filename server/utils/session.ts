import crypto from 'node:crypto'

export interface TelegramSessionUser {
  id: number
  username?: string
  firstName?: string | null
  lastName?: string | null
  photoUrl?: string | null
}

interface SessionPayload {
  user: TelegramSessionUser
  iat: number
}

function getSecret(secret: string): string {
  if (!secret) {
    throw new Error('Session secret is not configured')
  }
  return secret
}

export function createSessionToken(user: TelegramSessionUser, secret: string): string {
  const payload: SessionPayload = {
    user,
    iat: Math.floor(Date.now() / 1000),
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', getSecret(secret)).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sig}`
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  if (!token) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null

  const expectedSig = crypto
    .createHmac('sha256', getSecret(secret))
    .update(payloadB64)
    .digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null
  }

  try {
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8')
    return JSON.parse(json) as SessionPayload
  } catch {
    return null
  }
}

