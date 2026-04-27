import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { resolveIikoConfig } from '~/server/utils/iiko'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const [{ data: shop }, { data: mappings }, { data: jobs }, { data: events }] = await Promise.all([
    client.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle(),
    client.from('iiko_restaurant_mapping').select('id,restaurant_id,iiko_terminal_group_id').eq('shop_id', access.shopId),
    client.from('iiko_sync_jobs').select('id,job_type,status,mode,created_at,error').eq('shop_id', access.shopId).order('created_at', { ascending: false }).limit(20),
    client.from('iiko_events').select('id,event_type,external_event_id,created_at,error,processed_at').eq('shop_id', access.shopId).order('created_at', { ascending: false }).limit(20),
  ])

  const integrationKeys = (shop as any)?.integration_keys ?? {}
  const cfg = resolveIikoConfig(integrationKeys)
  const iiko = integrationKeys?.iiko ?? {}
  return {
    ok: true,
    config: {
      mode: cfg.mode,
      baseUrl: cfg.baseUrl,
      strictMode: cfg.strictMode,
      useIikoCardLoyalty: cfg.useIikoCardLoyalty,
      hasApiKey: Boolean(iiko?.apiKey),
    },
    mappings: mappings ?? [],
    jobs: jobs ?? [],
    events: events ?? [],
  }
})
