import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { mergeMetadataWithTimeline, type TimelineEntry } from '~/server/utils/dashboardOrders'

type Body = {
  kind?: string
  comment?: string | null
}

function telegramApi(token: string) {
  return `https://api.telegram.org/bot${token}/sendMessage`
}

function delayText(orderNumber: string, kind: 'kitchen' | 'delivery') {
  if (kind === 'delivery') {
    return `⏱ Небольшая задержка по доставке заказа #${orderNumber}: курьер уже в пути, но может приехать чуть позже. Спасибо за терпение.`
  }
  return `⏱ Небольшая задержка по заказу #${orderNumber}: кухня готовит ваше блюдо чуть дольше обычного. Спасибо за ожидание.`
}

function shortOrderRef(orderNumber: string): string {
  const normalized = orderNumber.replace(/\s+/g, '')
  return normalized.length > 8 ? normalized.slice(0, 8) : normalized
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Order id is required' })

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const kind: 'kitchen' | 'delivery' = body?.kind === 'delivery' ? 'delivery' : 'kitchen'
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

  const client = await serverSupabaseServiceRole(event)
  const { data: order, error: loadError } = await client
    .from('orders')
    .select('id,shop_id,order_number,customer_telegram_id,metadata')
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (loadError) throw createError({ statusCode: 500, statusMessage: 'Failed to load order' })
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  if (!order.customer_telegram_id) {
    throw createError({ statusCode: 400, statusMessage: 'У заказа нет Telegram клиента для уведомления' })
  }

  const { data: shop } = await client
    .from('shops')
    .select('telegram_bot_token')
    .eq('id', access.shopId)
    .maybeSingle()

  const config = useRuntimeConfig()
  const tokenFromShop = typeof shop?.telegram_bot_token === 'string' ? shop.telegram_bot_token.trim() : ''
  const botToken = tokenFromShop && tokenFromShop !== 'platform-bot' ? tokenFromShop : String(config.botToken || '')
  if (!botToken) throw createError({ statusCode: 500, statusMessage: 'Telegram bot token is not configured' })

  const orderNumber = shortOrderRef((order.order_number && String(order.order_number).trim()) || String(order.id))
  const text = delayText(orderNumber, kind)
  const telegramRes = await fetch(telegramApi(botToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(order.customer_telegram_id),
      text,
    }),
  }).catch(() => null)

  if (!telegramRes?.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Не удалось отправить уведомление клиенту' })
  }

  const now = new Date().toISOString()
  const entry: TimelineEntry = {
    at: now,
    label: `Уведомление о задержке (${kind === 'delivery' ? 'доставка' : 'кухня'}) отправлено клиенту${comment ? `: ${comment}` : ''}`,
    source: 'dashboard',
    userId: access.userId,
    comment: comment || null,
  }
  const newMetadata = mergeMetadataWithTimeline(order.metadata, entry)
  await client.from('orders').update({ metadata: newMetadata, updated_at: now }).eq('id', id).eq('shop_id', access.shopId)

  return { ok: true }
})
