import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { resolveQuickRestoConfig } from '~/server/utils/quickresto'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const [{ data: shop }, { data: mappings }, { data: jobs }, { data: events }] = await Promise.all([
    client.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle(),
    client.from('quickresto_restaurant_mapping').select('id,restaurant_id,quickresto_place_id').eq('shop_id', access.shopId),
    client.from('quickresto_sync_jobs').select('id,job_type,status,mode,created_at,error').eq('shop_id', access.shopId).order('created_at', { ascending: false }).limit(20),
    client.from('quickresto_events').select('id,event_type,external_event_id,created_at,error,processed_at').eq('shop_id', access.shopId).order('created_at', { ascending: false }).limit(20),
  ])

  const integrationKeys = (shop as any)?.integration_keys ?? {}
  const cfg = resolveQuickRestoConfig(integrationKeys)
  const qk = integrationKeys?.quickresto ?? {}
  return {
    ok: true,
    config: {
      mode: cfg.mode,
      baseUrl: cfg.baseUrl,
      strictMode: cfg.strictMode,
      hasApiKey: Boolean(qk?.apiKey),
    },
    mappings: mappings ?? [],
    jobs: jobs ?? [],
    events: events ?? [],
  }
})
