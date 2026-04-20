import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getQuickRestoClient } from '~/server/utils/quickresto'

type Body = { code?: string; amount?: number }

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const amount = Number(body.amount || 0)
  if (!code) throw createError({ statusCode: 400, statusMessage: 'code is required' })
  if (!Number.isFinite(amount) || amount < 0) throw createError({ statusCode: 400, statusMessage: 'amount is invalid' })
  const db = await serverSupabaseServiceRole(event)
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', shopId).maybeSingle()
  const { client } = getQuickRestoClient((shop as any)?.integration_keys ?? {})
  const result = await client.validatePromocode(code, amount)
  return { ok: true, ...result }
})
