import { createError, defineEventHandler, readBody } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { requireReviewsFeature } from '~/server/utils/reviews'
import { applyReviewModerationAction } from '~/server/utils/reviewsModeration'

type Body = {
  reviewId?: string
  action?: 'publish' | 'reject' | 'resolve' | 'reopen'
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  await requireReviewsFeature(event, access.shopId)
  const body = await readBody<Body>(event).catch(() => ({}))
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : ''
  if (!reviewId) {
    throw createError({ statusCode: 400, statusMessage: 'reviewId is required' })
  }
  const action = body.action || 'reject'
  const allowed = new Set(['publish', 'reject', 'resolve', 'reopen'])
  if (!allowed.has(action)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
  }

  const result = await applyReviewModerationAction(event, {
    reviewId,
    shopId: access.shopId,
    action: action as any,
    actorUserId: access.userId,
  })
  return { ok: true, status: result.status }
})
