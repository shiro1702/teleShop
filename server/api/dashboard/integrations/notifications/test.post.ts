import crypto from 'node:crypto'
import { createError, defineEventHandler, readBody } from 'h3'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { dispatchNotificationEvent } from '~/server/utils/notifications'

type Body = {
  restaurantId?: string
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const body = await readBody<Body>(event).catch(() => ({}))
  const restaurantId = body.restaurantId?.trim()
  if (!restaurantId) {
    throw createError({ statusCode: 400, statusMessage: 'restaurantId is required' })
  }

  await dispatchNotificationEvent(event, {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_CREATED',
    occurredAt: new Date().toISOString(),
    tenantContext: {
      shopId: access.shopId,
      restaurantId,
      cityId: null,
    },
    orderContext: {
      orderId: crypto.randomUUID(),
      orderNumber: 'TEST-ORDER',
      totalAmount: 0,
      status: 'new',
    },
  })

  return { ok: true }
})
