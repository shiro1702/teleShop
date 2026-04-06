import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { accrueLoyaltyEarnForPaidOrder } from '~/server/utils/pricingPromoBonus'

type YooWebhookPayload = {
  event?: string
  object?: {
    id?: string
    status?: string
    metadata?: Record<string, string>
  }
  id?: string
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<YooWebhookPayload>(event)
  const providerPaymentId = typeof payload?.object?.id === 'string' ? payload.object.id.trim() : ''
  const eventName = typeof payload?.event === 'string' ? payload.event : ''
  const eventIdRaw = typeof payload?.id === 'string' ? payload.id : ''
  const eventId = eventIdRaw || `${eventName}:${providerPaymentId}:${payload?.object?.status || 'unknown'}`

  if (!providerPaymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid YooKassa webhook payload: object.id is required' })
  }

  const client = await serverSupabaseServiceRole(event)

  const insertEvent = await client
    .from('payment_webhook_events')
    .insert({
      provider: 'yookassa',
      event_id: eventId,
      provider_payment_id: providerPaymentId,
      payload: payload ?? {},
      processed: false,
    })

  // duplicate event -> idempotent success
  if (insertEvent.error && insertEvent.error.code !== '23505') {
    throw createError({ statusCode: 500, statusMessage: 'Failed to persist webhook event' })
  }
  if (insertEvent.error && insertEvent.error.code === '23505') {
    return { ok: true, duplicate: true }
  }

  const { data: intent, error: intentError } = await client
    .from('order_payment_intents')
    .select('id,order_id,shop_id,status')
    .eq('provider', 'yookassa')
    .eq('provider_payment_id', providerPaymentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; order_id: string; shop_id: string; status: string }>()
  if (intentError || !intent) {
    throw createError({ statusCode: 404, statusMessage: 'Payment intent not found for webhook event' })
  }

  const paymentStatus = String(payload?.object?.status || '').toLowerCase()
  const nextOrderPaymentStatus =
    paymentStatus === 'succeeded'
      ? 'paid'
      : paymentStatus === 'canceled'
        ? 'canceled'
        : paymentStatus === 'pending'
          ? 'pending'
          : 'failed'

  const orderUpdatePayload: Record<string, unknown> = {
    payment_status: nextOrderPaymentStatus,
    payment_provider: 'yookassa',
    payment_id: providerPaymentId,
  }
  if (nextOrderPaymentStatus === 'paid') {
    orderUpdatePayload.paid_at = new Date().toISOString()
  }

  const { error: updateOrderError } = await client
    .from('orders')
    .update(orderUpdatePayload)
    .eq('id', intent.order_id)
    .eq('shop_id', intent.shop_id)
  if (updateOrderError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update order payment status' })
  }

  if (nextOrderPaymentStatus === 'paid') {
    await accrueLoyaltyEarnForPaidOrder(client, intent.order_id, intent.shop_id)
  }

  const { error: updateIntentError } = await client
    .from('order_payment_intents')
    .update({
      status: paymentStatus || 'unknown',
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id)
  if (updateIntentError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update payment intent status' })
  }

  const signature = getHeader(event, 'x-yookassa-signature') || ''
  const { error: markProcessedError } = await client
    .from('payment_webhook_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      payload: { ...(payload ?? {}), __headers: { x_yookassa_signature: signature } },
    })
    .eq('provider', 'yookassa')
    .eq('event_id', eventId)
  if (markProcessedError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to mark webhook event as processed' })
  }

  return { ok: true }
})
