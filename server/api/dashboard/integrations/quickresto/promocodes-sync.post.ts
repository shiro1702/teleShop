import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getQuickRestoClient } from '~/server/utils/quickresto'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only owner can sync promo codes' })
  const db = await serverSupabaseServiceRole(event)
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  const { client } = getQuickRestoClient((shop as any)?.integration_keys ?? {})
  const items = await client.fetchPromocodes()
  let synced = 0
  for (const code of items) {
    await db.from('shop_promo_codes').upsert({
      shop_id: access.shopId,
      code: code.code.trim().toUpperCase(),
      type: code.type,
      value: Math.max(0, Math.floor(code.value)),
      min_order_amount: Math.max(0, Math.floor(code.minOrderAmount)),
      is_active: true,
    }, { onConflict: 'shop_id,code' })
    synced += 1
  }
  await db.from('quickresto_sync_jobs').insert({
    shop_id: access.shopId,
    job_type: 'promocodes_sync',
    status: 'success',
    mode: 'run',
    initiated_by: access.userId,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    result: { synced },
  })
  return { ok: true, synced }
})
