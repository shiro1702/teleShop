import crypto from 'node:crypto'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import {
  mergeMetadataWithTimeline,
  normalizeDashboardStatus,
  getAllowedOrderStatusTransitions,
  type DashboardOrderStatus,
  type TimelineEntry,
} from '~/server/utils/dashboardOrders'
import { dashboardOrderStatusLabels } from '~/utils/dashboardOrderStatus'
import { dispatchNotificationEvent } from '~/server/utils/notifications'

type Body = {
  nextStatus?: string
  comment?: string | null
}

const statusLabels = dashboardOrderStatusLabels

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Order id is required' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const nextRaw = typeof body?.nextStatus === 'string' ? body.nextStatus.trim().toLowerCase() : ''
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

  const nextStatus: DashboardOrderStatus | null =
    nextRaw === 'in_progress' || nextRaw === 'in-progress'
      ? 'in_progress'
      : nextRaw === 'ready_for_pickup' || nextRaw === 'ready-for-pickup'
        ? 'ready_for_pickup'
        : nextRaw === 'out_for_delivery' || nextRaw === 'out-for-delivery'
          ? 'out_for_delivery'
          : nextRaw === 'handed_to_customer' || nextRaw === 'handed-to-customer' || nextRaw === 'done'
            ? 'handed_to_customer'
            : nextRaw === 'cancelled' || nextRaw === 'canceled'
              ? 'cancelled'
              : nextRaw === 'new'
                ? 'new'
                : null

  if (!nextStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid nextStatus' })
  }

  if (nextStatus === 'cancelled' && !comment) {
    throw createError({ statusCode: 400, statusMessage: 'Comment is required for cancellation' })
  }

  const client = await serverSupabaseServiceRole(event)

  const { data: existing, error: loadError } = await client
    .from('orders')
    .select('id,order_number,status,metadata,fulfillment_type,total,restaurant_id,city_id,customer_telegram_id')
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (loadError) {
    console.error('dashboard order status load:', loadError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order' })
  }

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  const current = normalizeDashboardStatus(existing.status as string)
  const allowed = getAllowedOrderStatusTransitions(current, existing.fulfillment_type as string | null)
  if (!allowed.includes(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status transition' })
  }

  const now = new Date().toISOString()
  const entry: TimelineEntry = {
    at: now,
    label: `Статус: ${statusLabels[current]} → ${statusLabels[nextStatus]}${comment ? ` (${comment})` : ''}`,
    from: current,
    to: nextStatus,
    source: 'dashboard',
    userId: access.userId,
    comment: comment || null,
  }

  const newMetadata = mergeMetadataWithTimeline(existing.metadata, entry)

  const { error: updateError } = await client
    .from('orders')
    .update({
      status: nextStatus,
      metadata: newMetadata,
      updated_at: now,
    })
    .eq('id', id)
    .eq('shop_id', access.shopId)

  if (updateError) {
    console.error('dashboard order status update:', updateError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update order' })
  }

  await dispatchNotificationEvent(event, {
    eventId: crypto.randomUUID(),
    eventType: 'ORDER_STATUS_CHANGED',
    occurredAt: now,
    tenantContext: {
      shopId: access.shopId,
      restaurantId: String((existing as any).restaurant_id || ''),
      cityId: (existing as any).city_id ? String((existing as any).city_id) : null,
    },
    orderContext: {
      orderId: String((existing as any).id),
      orderNumber: String((existing as any).order_number || (existing as any).id).slice(0, 32),
      totalAmount: Number((existing as any).total || 0),
      status: nextStatus,
    },
    actorContext: {
      customerTelegramId: (existing as any).customer_telegram_id ?? null,
    },
  })

  return { ok: true, status: nextStatus }
})
