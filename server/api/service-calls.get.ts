import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolveCustomerProfileId } from '~/server/utils/customerProfile'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orderId = typeof query.orderId === 'string' ? query.orderId.trim() : ''
  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'orderId is required' })

  const config = useRuntimeConfig(event)
  const tenant = event.context?.tenant as { telegramBotToken?: string } | undefined
  const botToken =
    typeof tenant?.telegramBotToken === 'string' && tenant.telegramBotToken.trim()
      ? tenant.telegramBotToken.trim()
      : String(config.botToken || '')
  if (!botToken) throw createError({ statusCode: 500, statusMessage: 'Bot token missing' })

  const profileId = await resolveCustomerProfileId(event, botToken).catch(() => '')
  if (!profileId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const client = await serverSupabaseServiceRole(event)
  const { data: order } = await client
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('customer_profile_id', profileId)
    .maybeSingle()
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

  const { data: calls, error } = await client
    .from('service_calls')
    .select('id,call_type,status,created_at,first_response_at,resolved_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw createError({ statusCode: 500, statusMessage: 'Failed to load service calls' })

  return {
    ok: true,
    items: (calls || []).map((row: any) => ({
      id: String(row.id),
      callType: String(row.call_type),
      status: String(row.status),
      createdAt: String(row.created_at),
      firstResponseAt: row.first_response_at ? String(row.first_response_at) : null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    })),
  }
})

