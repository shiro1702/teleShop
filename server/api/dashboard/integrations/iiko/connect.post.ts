import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getIikoClient } from '~/server/utils/iiko'

type Body = {
  mode?: 'mock' | 'http'
  baseUrl?: string
  apiKey?: string
  strictMode?: boolean
  useIikoCardLoyalty?: boolean
  restaurantMappings?: Array<{ restaurantId: string; iikoTerminalGroupId: string }>
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only owner can update iiko integration' })
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const db = await serverSupabaseServiceRole(event)
  const schemaCheck = await db.from('iiko_sync_jobs').select('id').limit(1)
  if (schemaCheck.error) throw createError({ statusCode: 500, statusMessage: 'iiko schema is not ready. Apply latest migrations first.' })

  const { data: shop, error: shopError } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  if (shopError) throw createError({ statusCode: 500, statusMessage: 'Failed to load shop integration settings' })
  const integrationKeys = ((shop as any)?.integration_keys ?? {}) as Record<string, any>
  const current = integrationKeys.iiko && typeof integrationKeys.iiko === 'object' ? integrationKeys.iiko : {}
  const nextIiko = {
    ...current,
    mode: body.mode === 'http' ? 'http' : 'mock',
    baseUrl: typeof body.baseUrl === 'string' && body.baseUrl.trim() ? body.baseUrl.trim() : (current.baseUrl || ''),
    apiKey: typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : (current.apiKey || ''),
    strictMode: body.strictMode === true,
    useIikoCardLoyalty: body.useIikoCardLoyalty === true,
  }
  if (nextIiko.mode === 'http' && !nextIiko.apiKey) throw createError({ statusCode: 400, statusMessage: 'apiKey is required for http mode' })

  const nextKeys = { ...integrationKeys, iiko: nextIiko }
  const updateShop = await db.from('shops').update({ integration_keys: nextKeys }).eq('id', access.shopId)
  if (updateShop.error) throw createError({ statusCode: 500, statusMessage: 'Failed to save iiko settings' })

  if (Array.isArray(body.restaurantMappings)) {
    for (const row of body.restaurantMappings) {
      if (!row?.restaurantId || !row?.iikoTerminalGroupId) continue
      const mappingUpsert = await db.from('iiko_restaurant_mapping').upsert({
        shop_id: access.shopId,
        restaurant_id: row.restaurantId,
        iiko_terminal_group_id: row.iikoTerminalGroupId.trim(),
        created_by: access.userId,
      }, { onConflict: 'shop_id,restaurant_id' })
      if (mappingUpsert.error) throw createError({ statusCode: 500, statusMessage: `Failed to save restaurant mapping: ${mappingUpsert.error.message}` })
    }
  }

  const { client, config } = getIikoClient(nextKeys)
  const health = await client.healthCheck()
  if (!health.ok) throw createError({ statusCode: 502, statusMessage: health.message || 'iiko health-check failed' })
  return { ok: true, mode: config.mode, health }
})
