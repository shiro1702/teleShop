import crypto from 'node:crypto'
import { createError } from 'h3'

export type VkPkcePair = {
  state: string
  codeVerifier: string
  codeChallenge: string
}

export type VkTokenExchangeResult = {
  access_token: string
  refresh_token?: string
  id_token?: string
  user_id?: string | number
  expires_in?: number
  token_type?: string
}

export type VkUserInfoResult = {
  user: {
    user_id?: string | number
    email?: string
    phone?: string
    first_name?: string
    last_name?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateVkPkcePair(): VkPkcePair {
  const state = crypto.randomBytes(18).toString('base64url')
  const codeVerifier = crypto.randomBytes(48).toString('base64url')
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest())
  return { state, codeVerifier, codeChallenge }
}

export function buildVkAuthorizeUrl(options: {
  baseUrl: string
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scope?: string
}): string {
  const base = options.baseUrl.replace(/\/$/, '')
  const q = new URLSearchParams()
  q.set('response_type', 'code')
  q.set('client_id', options.clientId)
  q.set('redirect_uri', options.redirectUri)
  q.set('state', options.state)
  q.set('code_challenge', options.codeChallenge)
  q.set('code_challenge_method', 'S256')
  q.set('scope', options.scope || 'email phone vkid.personal_info')
  return `${base}/authorize?${q.toString()}`
}

export async function exchangeVkCode(options: {
  baseUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
  codeVerifier: string
  deviceId?: string
  state?: string
}): Promise<VkTokenExchangeResult> {
  const base = options.baseUrl.replace(/\/$/, '')
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('client_id', options.clientId)
  body.set('client_secret', options.clientSecret)
  body.set('redirect_uri', options.redirectUri)
  body.set('code', options.code)
  body.set('code_verifier', options.codeVerifier)
  if (options.deviceId) body.set('device_id', options.deviceId)
  if (options.state) body.set('state', options.state)

  const res = await fetch(`${base}/oauth2/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw createError({
      statusCode: 401,
      statusMessage: `VK token exchange failed: ${res.status} ${txt}`,
    })
  }
  return await res.json() as VkTokenExchangeResult
}

export async function fetchVkUserInfo(options: {
  baseUrl: string
  accessToken: string
}): Promise<VkUserInfoResult> {
  const base = options.baseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/oauth2/user_info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: options.accessToken }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw createError({
      statusCode: 401,
      statusMessage: `VK user_info failed: ${res.status} ${txt}`,
    })
  }
  return await res.json() as VkUserInfoResult
}
