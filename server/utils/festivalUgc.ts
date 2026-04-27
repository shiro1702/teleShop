import { createError, type H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export type FestivalRow = {
  id: string
  slug: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export type CustomerIdentity = {
  profileId: string
  telegramId: number | null
  maxUserId: string | null
}

export async function resolveFestivalOrThrow(event: H3Event, festivalSlug: string): Promise<FestivalRow> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('festivals')
    .select('id,slug,starts_at,ends_at,is_active')
    .eq('slug', festivalSlug)
    .maybeSingle<FestivalRow>()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to resolve festival' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Festival not found' })
  }
  return data
}

export async function resolveCustomerIdentityOrThrow(event: H3Event): Promise<CustomerIdentity> {
  const config = useRuntimeConfig()
  const tenant = event.context?.tenant as { telegramBotToken?: string } | undefined
  const botToken =
    typeof tenant?.telegramBotToken === 'string' && tenant.telegramBotToken.trim()
      ? tenant.telegramBotToken.trim()
      : String(config.botToken || '')

  const profileId = await resolveCustomerProfileId(event, botToken)
  const client = await serverSupabaseServiceRole(event)
  const { data: profile } = await client
    .from('profiles')
    .select('telegram_id,max_user_id')
    .eq('id', profileId)
    .maybeSingle()

  return {
    profileId,
    telegramId: Number.isFinite(Number((profile as any)?.telegram_id))
      ? Number((profile as any)?.telegram_id)
      : null,
    maxUserId: typeof (profile as any)?.max_user_id === 'string' && String((profile as any).max_user_id).trim()
      ? String((profile as any).max_user_id).trim()
      : null,
  }
}

export async function isCustomerBannedForFestival(
  client: SupabaseClient,
  args: { festivalId: string; shopId: string; profileId: string; telegramId: number | null; maxUserId: string | null },
): Promise<boolean> {
  const checks: Array<PromiseLike<{ data: { id: string } | null; error: any }>> = [
    client
      .from('festival_ugc_bans')
      .select('id')
      .eq('festival_id', args.festivalId)
      .eq('shop_id', args.shopId)
      .eq('is_active', true)
      .eq('profile_id', args.profileId)
      .maybeSingle<{ id: string }>(),
  ]

  if (args.telegramId) {
    checks.push(
      client
        .from('festival_ugc_bans')
        .select('id')
        .eq('festival_id', args.festivalId)
        .eq('shop_id', args.shopId)
        .eq('is_active', true)
        .eq('telegram_id', args.telegramId)
        .maybeSingle<{ id: string }>(),
    )
  }
  if (args.maxUserId) {
    checks.push(
      client
        .from('festival_ugc_bans')
        .select('id')
        .eq('festival_id', args.festivalId)
        .eq('shop_id', args.shopId)
        .eq('is_active', true)
        .eq('max_user_id', args.maxUserId)
        .maybeSingle<{ id: string }>(),
    )
  }

  const results = await Promise.all(checks)
  return results.some((x) => !x.error && !!x.data?.id)
}

export async function loadEligibleFestivalOrders(
  client: SupabaseClient,
  args: { profileId: string; festivalId: string; shopId?: string; limit?: number },
) {
  let query = client
    .from('orders')
    .select('id,shop_id,restaurant_id,order_number,status,created_at,items,restaurants!inner(id,name,festival_id,shop_id)')
    .eq('customer_profile_id', args.profileId)
    .eq('restaurants.festival_id', args.festivalId)
    .eq('status', 'handed_to_customer')
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 20)
  if (args.shopId) {
    query = query.eq('shop_id', args.shopId)
  }
  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load festival orders' })
  }
  return (data ?? []) as Array<Record<string, any>>
}
