import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { requireReviewsFeature } from '~/server/utils/reviews'
import { enqueueManualReviewPrompts } from '~/server/utils/reviewPromptFlow'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  await requireReviewsFeature(event, access.shopId)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Order id is required' })
  }

  try {
    const result = await enqueueManualReviewPrompts(event, {
      shopId: access.shopId,
      orderId: id,
      actorProfileId: access.userId,
    })
    return { ok: true, ...result }
  } catch (e: any) {
    const msg = String(e?.message || 'failed')
    if (msg === 'feature_disabled') {
      throw createError({ statusCode: 402, statusMessage: 'Review prompts module disabled' })
    }
    if (msg === 'order_not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
