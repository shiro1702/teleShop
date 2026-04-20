import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getQuickRestoClient } from '~/server/utils/quickresto'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can run health-check' })
  }
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
  const { client, config } = getQuickRestoClient((shop as any)?.integration_keys ?? {})
  if (config.mode === 'http' && !config.apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is required for http mode' })
  }
  const health = await client.healthCheck()
  if (!health.ok) {
    throw createError({ statusCode: 502, statusMessage: health.message || 'Quick Resto health-check failed' })
  }
  return { ok: true, mode: config.mode, message: health.message }
})
