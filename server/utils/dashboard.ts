import { createError } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export type DashboardAccess = {
  userId: string
  shopId: string
  role: 'owner' | 'manager'
}

function normalizeRole(input: unknown): 'owner' | 'manager' {
  if (typeof input !== 'string') return 'owner'
  const value = input.trim().toLowerCase()
  return value === 'manager' ? 'manager' : 'owner'
}

export async function requireDashboardAccess(event: any): Promise<DashboardAccess> {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const raw = supabaseUser as any
  const userId = typeof raw.id === 'string'
    ? raw.id
    : typeof raw.sub === 'string'
      ? raw.sub
      : null
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = await serverSupabaseServiceRole(event)
  let shopId: string | null = null
  let role: 'owner' | 'manager' = 'owner'

  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('shop_id,role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError && !/column .*role/i.test(profileError.message)) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to read profile' })
  }

  if (profileData?.shop_id) {
    shopId = profileData.shop_id as string
    role = normalizeRole((profileData as any).role)
  }

  if (!shopId) {
    const fallback = await client
      .from('profiles')
      .select('shop_id')
      .eq('id', userId)
      .maybeSingle()
    if (fallback.error) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to read profile' })
    }
    if (fallback.data?.shop_id) {
      shopId = fallback.data.shop_id as string
      role = 'owner'
    }
  }

  if (!shopId) {
    const metadataShopId = typeof raw.user_metadata?.active_shop_id === 'string'
      ? raw.user_metadata.active_shop_id.trim()
      : ''
    if (metadataShopId) {
      shopId = metadataShopId
      role = normalizeRole(raw.user_metadata?.admin_role)
    }
  }

  if (!shopId) {
    const memberAccess = await client
      .from('shop_members')
      .select('shop_id,role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Support legacy/new deployments where shop_members may not exist yet.
    if (memberAccess.error && !/relation .*shop_members.* does not exist/i.test(memberAccess.error.message)) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to read shop membership' })
    }

    if (memberAccess.data?.shop_id) {
      shopId = memberAccess.data.shop_id as string
      role = normalizeRole((memberAccess.data as any).role)
    }
  }

  if (!shopId) {
    throw createError({ statusCode: 403, statusMessage: 'No shop access. Complete onboarding first.' })
  }

  return { userId, shopId, role }
}
