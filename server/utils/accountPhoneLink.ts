import type { SupabaseClient } from '@supabase/supabase-js'

type ServiceClient = SupabaseClient<any, 'public', any>

export function normalizePhone(raw: string): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`
  if (digits.length === 10) return `+7${digits}`
  return trimmed.startsWith('+') ? trimmed : `+${digits}`
}

function phoneFromUserMetadata(meta: Record<string, unknown> | null | undefined): string {
  const raw = typeof meta?.phone === 'string' ? meta.phone : ''
  return raw ? normalizePhone(raw) : ''
}

export async function findProfileIdByPhone(
  serviceClient: ServiceClient,
  phoneRaw: string,
): Promise<string | null> {
  const normalized = normalizePhone(phoneRaw)
  if (!normalized) return null

  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users ?? []
    const hit = users.find((u) => phoneFromUserMetadata((u.user_metadata as Record<string, unknown> | undefined) ?? null) === normalized)
    if (hit?.id) {
      const { data: profile } = await serviceClient.from('profiles').select('id').eq('id', hit.id).maybeSingle()
      if (profile?.id) return String(profile.id)
    }
    if (users.length < perPage) break
    page += 1
  }
  return null
}

export async function getProfilePhone(serviceClient: ServiceClient, profileId: string): Promise<string> {
  if (!profileId) return ''
  const { data } = await serviceClient.auth.admin.getUserById(profileId)
  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>
  return phoneFromUserMetadata(meta)
}

export async function setProfilePhone(
  serviceClient: ServiceClient,
  profileId: string,
  phoneRaw: string,
): Promise<string> {
  const normalized = normalizePhone(phoneRaw)
  if (!profileId || !normalized) return ''
  const { data } = await serviceClient.auth.admin.getUserById(profileId)
  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>
  await serviceClient.auth.admin.updateUserById(profileId, {
    user_metadata: { ...meta, phone: normalized },
  })
  return normalized
}
