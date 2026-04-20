import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getQuickRestoClient } from '~/server/utils/quickresto'

type Body = { dryRun?: boolean }

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only owner can run menu sync' })
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const db = await serverSupabaseServiceRole(event)
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  const { client } = getQuickRestoClient((shop as any)?.integration_keys ?? {})
  const syncJob = await db.from('quickresto_sync_jobs').insert({
    shop_id: access.shopId,
    job_type: 'menu_sync',
    mode: body.dryRun ? 'dry_run' : 'run',
    status: 'running',
    started_at: new Date().toISOString(),
    initiated_by: access.userId,
  }).select('id').single()

  try {
    const menu = await client.fetchMenu()
    const categoryMap = new Map<string, string>()
    const diff: Array<{ type: string; externalId: string; action: string }> = []
    for (const c of menu.categories) {
      const { data: found } = await db.from('categories').select('id').eq('shop_id', access.shopId).eq('external_id', c.externalId).maybeSingle()
      if (body.dryRun) {
        diff.push({ type: 'category', externalId: c.externalId, action: found ? 'update' : 'create' })
        if (found?.id) categoryMap.set(c.externalId, found.id)
        continue
      }
      const { data } = await db.from('categories').upsert({
        shop_id: access.shopId,
        external_id: c.externalId,
        name: c.name,
        sort_order: c.sortOrder,
        is_active: true,
      }, { onConflict: 'shop_id,external_id' }).select('id').single()
      if (data?.id) categoryMap.set(c.externalId, data.id)
    }
    for (const item of menu.items) {
      const categoryId = categoryMap.get(item.categoryExternalId) || null
      const { data: found } = await db.from('products').select('id').eq('shop_id', access.shopId).eq('external_id', item.externalId).maybeSingle()
      if (body.dryRun) {
        diff.push({ type: 'product', externalId: item.externalId, action: found ? 'update' : 'create' })
        continue
      }
      await db.from('products').upsert({
        shop_id: access.shopId,
        external_id: item.externalId,
        name: item.name,
        price: item.price,
        is_active: item.isActive,
        category_id: categoryId,
        category: 'quickresto',
        image: '',
      }, { onConflict: 'shop_id,external_id' })
    }
    await db.from('quickresto_sync_jobs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      result: { categories: menu.categories.length, items: menu.items.length, diff },
    }).eq('id', syncJob.data?.id)
    return { ok: true, dryRun: !!body.dryRun, diff, counts: { categories: menu.categories.length, items: menu.items.length } }
  } catch (error: any) {
    const message = error?.data?.statusMessage || error?.message || 'Menu sync failed'
    await db.from('quickresto_sync_jobs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: message,
    }).eq('id', syncJob.data?.id)
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
