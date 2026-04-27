import { createError, defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import {
  isCustomerBannedForFestival,
  loadEligibleFestivalOrders,
  resolveCustomerIdentityOrThrow,
  resolveFestivalOrThrow,
} from '~/server/utils/festivalUgc'

export default defineEventHandler(async (event) => {
  const festivalSlug = getRouterParam(event, 'festival_slug')
  if (!festivalSlug) {
    throw createError({ statusCode: 400, statusMessage: 'festival_slug is required' })
  }

  const { shopId } = await requireTenantShop(event)
  const festival = await resolveFestivalOrThrow(event, festivalSlug)
  const identity = await resolveCustomerIdentityOrThrow(event)
  const client = await serverSupabaseServiceRole(event)

  const isBanned = await isCustomerBannedForFestival(client, {
    festivalId: festival.id,
    shopId,
    profileId: identity.profileId,
    telegramId: identity.telegramId,
    maxUserId: identity.maxUserId,
  })
  if (isBanned) {
    return {
      ok: true,
      festivalId: festival.id,
      profileId: identity.profileId,
      canPostStory: false,
      canPostReview: false,
      reason: 'banned',
      ordersForReview: [],
    }
  }

  const orders = await loadEligibleFestivalOrders(client, {
    profileId: identity.profileId,
    festivalId: festival.id,
    shopId,
    limit: 30,
  })

  const canPostStory = orders.length > 0
  const ordersForReview = orders.map((x) => ({
    id: String(x.id),
    orderNumber: String(x.order_number || x.id),
    restaurantId: String(x.restaurant_id || ''),
    restaurantName: String((x.restaurants as any)?.name || 'Корнер'),
    createdAt: String(x.created_at || ''),
    items: Array.isArray(x.items) ? x.items : [],
  }))

  return {
    ok: true,
    festivalId: festival.id,
    profileId: identity.profileId,
    canPostStory,
    canPostReview: ordersForReview.length > 0,
    ordersForReview,
  }
})
