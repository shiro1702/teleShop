import { createError, defineEventHandler, readBody } from 'h3'
import { requireTenantShop } from '~/server/utils/tenant'
import {
  requireOwnedOrderForReview,
  requireReviewsFeature,
  resolveReviewIdentity,
} from '~/server/utils/reviews'
import { updateShopReviewRating } from '~/server/utils/shopReviewWrite'

type Body = {
  orderId?: string
  rating?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => ({}))
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const rating = Number(body.rating || 0)
  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'rating from 1 to 5 is required' })
  }

  const { shopId } = await requireTenantShop(event)
  await requireReviewsFeature(event, shopId)
  const identity = await resolveReviewIdentity(event)
  const order = await requireOwnedOrderForReview(event, { shopId, orderId, identity })

  const review = await updateShopReviewRating(event, {
    shopId,
    order: { id: order.id, shop_id: order.shop_id, restaurant_id: order.restaurant_id },
    identity,
    rating,
    actorChannel: identity.maxUserId ? 'max' : identity.telegramId ? 'telegram' : 'system',
  })

  return { ok: true, item: review }
})
