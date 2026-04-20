import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can run Quick Resto smoke seed' })
  }
  const db = await serverSupabaseServiceRole(event)
  const now = new Date().toISOString()
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  const qk = ((shop as any)?.integration_keys?.quickresto ?? {}) as Record<string, any>
  const mode = qk.mode === 'http' ? 'http' : 'mock'
  if (mode !== 'mock') {
    throw createError({ statusCode: 400, statusMessage: 'Smoke seed доступен только в mock режиме' })
  }

  await db.from('quickresto_sync_jobs').insert([
    {
      shop_id: access.shopId,
      job_type: 'menu_sync',
      mode: 'dry_run',
      status: 'success',
      initiated_by: access.userId,
      started_at: now,
      finished_at: now,
      result: { categories: 2, items: 2, diffCount: 3 },
    },
    {
      shop_id: access.shopId,
      job_type: 'order_retry',
      mode: 'run',
      status: 'failed',
      initiated_by: access.userId,
      started_at: now,
      finished_at: now,
      error: 'Mock timeout during dispatch',
      result: { sent: 0, failed: 1 },
    },
  ])

  await db.from('quickresto_events').insert([
    {
      shop_id: access.shopId,
      event_type: 'menu_availability',
      external_event_id: `seed-${Date.now()}-1`,
      payload: { source: 'smoke-seed', items: [{ externalProductId: 'prod-cola', inStopList: true }] },
      processed_at: now,
    },
    {
      shop_id: access.shopId,
      event_type: 'menu_availability',
      external_event_id: `seed-${Date.now()}-2`,
      payload: { source: 'smoke-seed', items: [{ externalProductId: 'prod-cola', inStopList: false }] },
      error: 'Signature missing (demo)',
    },
  ])

  return { ok: true, seeded: true }
})
