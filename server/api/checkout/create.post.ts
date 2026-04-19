import crypto from 'node:crypto'
import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { createYooKassaPayment } from '~/server/utils/yookassa'

type Body = {
  orderId?: string
  returnUrl?: string
}

function buildFallbackReturnUrl(appUrl: string, shopSlug: string): string {
  const trimmed = (appUrl || '').replace(/\/+$/, '')
  return `${trimmed}/${encodeURIComponent(shopSlug)}/checkout?step=2`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  const config = useRuntimeConfig()
  const { shopId, shop } = await requireTenantShop(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id,shop_id,total,payment_method,payment_status,payment_id')
    .eq('id', orderId)
    .eq('shop_id', shopId)
    .maybeSingle<{
      id: string
      shop_id: string
      total: number
      payment_method: string
      payment_status: string
      payment_id: string | null
    }>()
  if (orderError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load order for payment' })
  }
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }
  if (order.payment_method !== 'online') {
    throw createError({ statusCode: 400, statusMessage: 'Order payment method is not online' })
  }
  if (order.payment_status === 'paid') {
    throw createError({ statusCode: 400, statusMessage: 'Order is already paid' })
  }

  const yookassaShopId =
    (shop.yookassa_shop_id || '').trim()
    || (typeof shop.integration_keys?.yookassa_shop_id === 'string' ? shop.integration_keys.yookassa_shop_id.trim() : '')
  const yookassaSecretKey =
    (shop.yookassa_secret_key || '').trim()
    || (typeof shop.integration_keys?.yookassa_secret_key === 'string' ? shop.integration_keys.yookassa_secret_key.trim() : '')

  if (!yookassaShopId || !yookassaSecretKey) {
    throw createError({ statusCode: 400, statusMessage: 'YooKassa settings are not configured for this shop' })
  }

  const returnUrl = typeof body?.returnUrl === 'string' && /^https?:\/\//.test(body.returnUrl.trim())
    ? body.returnUrl.trim()
    : buildFallbackReturnUrl(String(config.appUrl || ''), shop.slug)

  const idempotenceKey = crypto.randomUUID()
  const yk = await createYooKassaPayment({
    shopId: yookassaShopId,
    secretKey: yookassaSecretKey,
    idempotenceKey,
    amountRub: Math.max(0, Number(order.total || 0)),
    description: `Order ${order.id}`,
    returnUrl,
    metadata: {
      order_id: order.id,
      shop_id: shopId,
    },
  })

  if (!yk.id) {
    throw createError({ statusCode: 502, statusMessage: 'YooKassa response has no payment id' })
  }

  const { error: intentError } = await client.from('order_payment_intents').insert({
    order_id: order.id,
    shop_id: shopId,
    provider: 'yookassa',
    provider_payment_id: yk.id,
    amount: Math.max(0, Number(order.total || 0)),
    status: yk.status || 'created',
    idempotence_key: idempotenceKey,
    confirmation_url: yk.confirmationUrl,
    raw_response: yk.raw ?? {},
  })
  if (intentError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save payment intent' })
  }

  const { error: updateOrderError } = await client
    .from('orders')
    .update({
      payment_provider: 'yookassa',
      payment_id: yk.id,
      payment_status: 'pending',
    })
    .eq('id', order.id)
    .eq('shop_id', shopId)
  if (updateOrderError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update order payment state' })
  }

  return {
    ok: true,
    paymentId: yk.id,
    confirmationUrl: yk.confirmationUrl,
  }
})
