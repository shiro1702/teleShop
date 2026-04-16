import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getQuickRestoClient } from '~/server/utils/quickresto'

type Body = {
  mode?: 'mock' | 'http'
  baseUrl?: string
  apiKey?: string
  strictMode?: boolean
  restaurantMappings?: Array<{ restaurantId: string; quickrestoPlaceId: string }>
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can update Quick Resto integration' })
  }
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const db = await serverSupabaseServiceRole(event)
  const schemaCheck = await db.from('quickresto_sync_jobs').select('id').limit(1)
  if (schemaCheck.error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Quick Resto schema is not ready. Apply latest migrations first.',
    })
  }
  const { data: shop, error: shopError } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  if (shopError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load shop integration settings' })
  }
  const integrationKeys = ((shop as any)?.integration_keys ?? {}) as Record<string, any>
  const current = integrationKeys.quickresto && typeof integrationKeys.quickresto === 'object' ? integrationKeys.quickresto : {}
  const nextQuickResto = {
    ...current,
    mode: body.mode === 'http' ? 'http' : 'mock',
    baseUrl: typeof body.baseUrl === 'string' && body.baseUrl.trim() ? body.baseUrl.trim() : (current.baseUrl || ''),
    apiKey: typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : (current.apiKey || ''),
    strictMode: body.strictMode === true,
  }
  if (nextQuickResto.mode === 'http' && !nextQuickResto.apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is required for http mode' })
  }
  const nextKeys = { ...integrationKeys, quickresto: nextQuickResto }
  const updateShop = await db.from('shops').update({ integration_keys: nextKeys }).eq('id', access.shopId)
  if (updateShop.error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save Quick Resto settings' })
  }

  if (Array.isArray(body.restaurantMappings)) {
    for (const row of body.restaurantMappings) {
      if (!row?.restaurantId || !row?.quickrestoPlaceId) continue
      const mappingUpsert = await db.from('quickresto_restaurant_mapping').upsert({
        shop_id: access.shopId,
        restaurant_id: row.restaurantId,
        quickresto_place_id: row.quickrestoPlaceId.trim(),
        created_by: access.userId,
      }, { onConflict: 'shop_id,restaurant_id' })
      if (mappingUpsert.error) {
        throw createError({ statusCode: 500, statusMessage: `Failed to save restaurant mapping: ${mappingUpsert.error.message}` })
      }
    }
  }

  const { client, config } = getQuickRestoClient(nextKeys)
  const health = await client.healthCheck()
  if (!health.ok) {
    throw createError({ statusCode: 502, statusMessage: health.message || 'Quick Resto health-check failed' })
  }
  return { ok: true, mode: config.mode, health }
})
