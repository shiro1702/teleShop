import { createError, getHeader, type H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'
import { requireShopFeature } from '~/server/utils/features'

export type ReviewStatus = 'new' | 'manager_review' | 'published' | 'rejected' | 'resolved'

export type ReviewIdentity = {
  profileId: string | null
  telegramId: number | null
  maxUserId: string | null
}

export async function requireReviewsFeature(event: H3Event, shopId: string): Promise<void> {
  await requireShopFeature(event, shopId, 'reputation_reviews_pro')
}

export async function resolveReviewIdentity(event: H3Event): Promise<ReviewIdentity> {
  const user = await serverSupabaseUser(event)
  if (user) {
    const rawUser = user as any
    const userId =
      typeof rawUser.id === 'string'
        ? rawUser.id
        : typeof rawUser.sub === 'string'
          ? rawUser.sub
          : ''
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const client = await serverSupabaseServiceRole(event)
    const { data: profile } = await client
      .from('profiles')
      .select('id,telegram_id,max_user_id')
      .eq('id', userId)
      .maybeSingle()
    return {
      profileId: userId,
      telegramId: profile?.telegram_id != null ? Number(profile.telegram_id) : null,
      maxUserId: typeof profile?.max_user_id === 'string' && profile.max_user_id.trim() ? profile.max_user_id.trim() : null,
    }
  }

  const botToken =
    typeof (event.context?.tenant as any)?.telegramBotToken === 'string'
      ? String((event.context?.tenant as any).telegramBotToken).trim()
      : ''
  if (!botToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const profileId = await resolveCustomerProfileId(event, botToken)
  const client = await serverSupabaseServiceRole(event)
  const { data: profile } = await client
    .from('profiles')
    .select('telegram_id,max_user_id')
    .eq('id', profileId)
    .maybeSingle()

  return {
    profileId,
    telegramId: profile?.telegram_id != null ? Number(profile.telegram_id) : null,
    maxUserId: typeof profile?.max_user_id === 'string' && profile.max_user_id.trim() ? profile.max_user_id.trim() : null,
  }
}

export async function requireOwnedOrderForReview(event: H3Event, args: {
  shopId: string
  orderId: string
  identity: ReviewIdentity
}): Promise<{
  id: string
  shop_id: string
  restaurant_id: string | null
  customer_profile_id: string | null
  customer_telegram_id: number | null
}> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('orders')
    .select('id,shop_id,restaurant_id,customer_profile_id,customer_telegram_id')
    .eq('id', args.orderId)
    .eq('shop_id', args.shopId)
    .maybeSingle()
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const profileMatch = args.identity.profileId && data.customer_profile_id && String(data.customer_profile_id) === args.identity.profileId
  const telegramMatch = args.identity.telegramId != null && data.customer_telegram_id != null && Number(data.customer_telegram_id) === Number(args.identity.telegramId)

  let maxMatch = false
  if (args.identity.maxUserId && data.customer_profile_id) {
    const { data: prof } = await client
      .from('profiles')
      .select('max_user_id')
      .eq('id', String(data.customer_profile_id))
      .maybeSingle()
    const stored = typeof (prof as any)?.max_user_id === 'string' ? String((prof as any).max_user_id).trim() : ''
    maxMatch = Boolean(stored && stored === String(args.identity.maxUserId).trim())
  }

  if (!profileMatch && !telegramMatch && !maxMatch) {
    throw createError({ statusCode: 403, statusMessage: 'Order does not belong to current customer' })
  }

  return data as any
}

export function sanitizeReviewComment(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const normalized = input.trim()
  if (!normalized) return null
  return normalized.slice(0, 2000)
}

export function sanitizeVideoUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const normalized = input.trim()
  if (!normalized) return null
  if (!/^https?:\/\//i.test(normalized)) return null
  return normalized.slice(0, 2000)
}

export function resolveInitialReviewStatus(rating: number): ReviewStatus {
  return rating <= 3 ? 'manager_review' : 'published'
}

export function resolveManagerNotificationMode(channelRow: any): { channel: 'telegram' | 'max' | null; chatId: string | null } {
  if (!channelRow) return { channel: null, chatId: null }
  const tg = typeof channelRow.telegram_chat_id === 'string' ? channelRow.telegram_chat_id.trim() : ''
  const max = typeof channelRow.max_chat_id === 'string' ? channelRow.max_chat_id.trim() : ''
  if (tg) return { channel: 'telegram', chatId: tg }
  if (max) return { channel: 'max', chatId: max }
  return { channel: null, chatId: null }
}

export function parseListLimit(raw: unknown, defaults = 20, max = 100): number {
  return Math.min(Math.max(Number(raw) || defaults, 1), max)
}

export function readHeaderShopId(event: H3Event): string | null {
  const h = getHeader(event, 'x-shop-id')
  return typeof h === 'string' && h.trim() ? h.trim() : null
}
