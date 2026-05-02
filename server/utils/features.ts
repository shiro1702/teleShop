import { createError, type H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type FeatureCatalogRow = {
  code: string
  dependencies: unknown
}

function parseDependencies(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
}

async function loadCatalog(event: H3Event, code: string): Promise<FeatureCatalogRow | null> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('feature_catalog')
    .select('code,dependencies')
    .eq('code', code)
    .maybeSingle()
  if (error) {
    if (/relation .*feature_catalog.* does not exist/i.test(error.message)) return null
    throw createError({ statusCode: 500, statusMessage: 'Failed to read feature catalog' })
  }
  return data as FeatureCatalogRow | null
}

async function isFeatureEnabledDirect(event: H3Event, shopId: string, code: string): Promise<boolean> {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('shop_feature_subscriptions')
    .select('enabled')
    .eq('shop_id', shopId)
    .eq('feature_code', code)
    .maybeSingle()
  if (error) {
    if (/relation .*shop_feature_subscriptions.* does not exist/i.test(error.message)) return false
    throw createError({ statusCode: 500, statusMessage: 'Failed to read feature subscriptions' })
  }
  return data?.enabled === true
}

export async function isShopFeatureEnabled(event: H3Event, shopId: string, code: string): Promise<boolean> {
  const catalog = await loadCatalog(event, code)
  if (!catalog) return false
  const enabled = await isFeatureEnabledDirect(event, shopId, code)
  if (!enabled) return false

  const deps = parseDependencies(catalog.dependencies)
  for (const dep of deps) {
    const depEnabled = await isFeatureEnabledDirect(event, shopId, dep)
    if (!depEnabled) return false
  }
  return true
}

export async function requireShopFeature(event: H3Event, shopId: string, code: string): Promise<void> {
  const enabled = await isShopFeatureEnabled(event, shopId, code)
  if (!enabled) {
    throw createError({
      statusCode: 402,
      statusMessage: `Feature ${code} is disabled for this shop`,
    })
  }
}
