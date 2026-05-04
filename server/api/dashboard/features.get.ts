import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: subs } = await client
    .from('shop_feature_subscriptions')
    .select('feature_code,enabled,started_at,ended_at,source')
    .eq('shop_id', access.shopId)

  const { data: catalog } = await client
    .from('feature_catalog')
    .select('code,name,billing_type,price,currency,dependencies,status')

  const catalogRows = (catalog ?? []) as Array<Record<string, unknown>>
  const subByCode = new Map((subs ?? []).map((x: any) => [String(x.feature_code), x]))

  const items = catalogRows.map((row: any) => {
    const code = String(row.code || '')
    const sub = subByCode.get(code)
    return {
      code,
      name: String(row.name || code),
      billingType: String(row.billing_type || ''),
      price: Number(row.price || 0),
      currency: String(row.currency || 'RUB'),
      dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
      catalogStatus: String(row.status || 'available'),
      enabled: sub?.enabled === true,
      startedAt: sub?.started_at || null,
      endedAt: sub?.ended_at || null,
      source: sub?.source || null,
    }
  })

  return { ok: true, items }
})
