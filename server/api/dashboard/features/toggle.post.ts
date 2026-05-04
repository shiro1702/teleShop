import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  featureCode?: string
  enabled?: boolean
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can toggle modules' })
  }

  const body = await readBody<Body>(event).catch(() => ({}))
  const featureCode = typeof body.featureCode === 'string' ? body.featureCode.trim() : ''
  const enabled = body.enabled === true
  if (!featureCode) {
    throw createError({ statusCode: 400, statusMessage: 'featureCode is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: catalogRow } = await client
    .from('feature_catalog')
    .select('code')
    .eq('code', featureCode)
    .maybeSingle()
  if (!catalogRow?.code) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown feature code' })
  }

  const { error } = await client
    .from('shop_feature_subscriptions')
    .upsert({
      shop_id: access.shopId,
      feature_code: featureCode,
      enabled,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id,feature_code' })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to update subscription' })
  }

  await client.from('shop_feature_events').insert({
    shop_id: access.shopId,
    feature_code: featureCode,
    action: enabled ? 'enabled' : 'disabled',
    payload: {},
    actor_user_id: access.userId,
  })

  return { ok: true, enabled }
})
