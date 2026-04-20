import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { dispatchQuickRestoOutbox } from '~/server/utils/quickresto'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only owner can retry failed orders' })
  const db = await serverSupabaseServiceRole(event)
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  const result = await dispatchQuickRestoOutbox(db, access.shopId, (shop as any)?.integration_keys ?? {})
  await db.from('quickresto_sync_jobs').insert({
    shop_id: access.shopId,
    job_type: 'order_retry',
    status: 'success',
    mode: 'run',
    initiated_by: access.userId,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    result,
  })
  return { ok: true, ...result }
})
