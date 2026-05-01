import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { buildAuthSiteLinkUrl } from '~/server/utils/authSiteLink'
import { exchangeVkCode, fetchVkUserInfo } from '~/server/utils/vkOAuth'

function toErrorMessage(raw: unknown): string {
  if (typeof raw !== 'string') return 'vk_oauth_failed'
  return encodeURIComponent(raw.slice(0, 200))
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code.trim() : ''
  const state = typeof query.state === 'string' ? query.state.trim() : ''
  const deviceId = typeof query.device_id === 'string' ? query.device_id.trim() : ''
  const errorFromVk = typeof query.error === 'string' ? query.error.trim() : ''
  const config = useRuntimeConfig()
  const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')
  const defaultCitySlug =
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'

  if (!state) {
    throw createError({ statusCode: 400, statusMessage: 'state is required' })
  }
  const serviceClient = await serverSupabaseServiceRole(event)
  const { data: row, error: rowError } = await serviceClient
    .from('auth_tokens')
    .select('token, channel, expires_at, vk_state, vk_code_verifier, vk_user_id, bridge_payload')
    .eq('vk_state', state)
    .maybeSingle()

  if (rowError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to read VK auth token' })
  }
  if (!row || String((row as { channel?: string }).channel || '') !== 'vk') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid VK state' })
  }

  const token = String((row as { token: string }).token)
  const expiresAt = new Date(String((row as { expires_at?: string }).expires_at)).getTime()
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    await serviceClient.from('auth_tokens').delete().eq('token', token)
    return sendRedirect(event, `/link-vk?token=${encodeURIComponent(token)}&error=token_expired`, 302)
  }
  if (errorFromVk) {
    return sendRedirect(event, `/link-vk?token=${encodeURIComponent(token)}&error=${toErrorMessage(errorFromVk)}`, 302)
  }
  if (!code) {
    return sendRedirect(event, `/link-vk?token=${encodeURIComponent(token)}&error=missing_code`, 302)
  }

  const vkClientId = String(config.public?.vkIdClientId || '').trim()
  const vkClientSecret = String(config.vkIdClientSecret || '').trim()
  const vkRedirectUri = String(config.vkIdRedirectUri || '').trim()
  const vkBaseUrl = String(config.vkIdBaseUrl || '').trim() || 'https://id.vk.com'
  const codeVerifier = String((row as { vk_code_verifier?: string }).vk_code_verifier || '').trim()
  if (!vkClientId || !vkClientSecret || !vkRedirectUri || !codeVerifier) {
    throw createError({ statusCode: 500, statusMessage: 'VK OAuth configuration is invalid' })
  }

  try {
    const tokenRes = await exchangeVkCode({
      baseUrl: vkBaseUrl,
      clientId: vkClientId,
      clientSecret: vkClientSecret,
      redirectUri: vkRedirectUri,
      code,
      codeVerifier,
      deviceId: deviceId || undefined,
      state,
    })
    const accessToken = String(tokenRes.access_token || '').trim()
    if (!accessToken) throw new Error('missing_access_token')
    const userInfo = await fetchVkUserInfo({
      baseUrl: vkBaseUrl,
      accessToken,
    })
    const vkUserRaw = userInfo?.user?.user_id ?? tokenRes.user_id
    const vkUserId = vkUserRaw != null ? String(vkUserRaw).trim() : ''
    if (!vkUserId) throw new Error('missing_vk_user_id')

    const existingVk = String((row as { vk_user_id?: string | null }).vk_user_id || '').trim()
    if (existingVk && existingVk !== vkUserId) {
      return sendRedirect(event, `/link-vk?token=${encodeURIComponent(token)}&error=token_already_bound`, 302)
    }

    const bridgePayload = {
      ...(((row as { bridge_payload?: Record<string, unknown> }).bridge_payload || {}) as Record<string, unknown>),
      vk_email: typeof userInfo?.user?.email === 'string' ? userInfo.user.email : null,
      vk_phone: typeof userInfo?.user?.phone === 'string' ? userInfo.user.phone : null,
    }

    if (!existingVk) {
      const { error: updErr } = await serviceClient
        .from('auth_tokens')
        .update({
          vk_user_id: vkUserId,
          vk_device_id: deviceId || null,
          bridge_payload: bridgePayload,
        })
        .eq('token', token)
        .is('vk_user_id', null)
      if (updErr) {
        throw updErr
      }
    } else {
      await serviceClient
        .from('auth_tokens')
        .update({
          vk_device_id: deviceId || null,
          bridge_payload: bridgePayload,
        })
        .eq('token', token)
    }

    const link = buildAuthSiteLinkUrl({
      linkPath: 'link-vk',
      appUrlBase,
      defaultCitySlug,
      token,
      bridgePayload,
      tenantShop: (event.context.tenant as { shop?: { slug?: string; custom_domain?: string | null } } | undefined)?.shop,
    })

    return sendRedirect(event, link, 302)
  } catch (err: any) {
    const status = err?.statusMessage || err?.message || 'vk_oauth_failed'
    return sendRedirect(event, `/link-vk?token=${encodeURIComponent(token)}&error=${toErrorMessage(status)}`, 302)
  }
})
