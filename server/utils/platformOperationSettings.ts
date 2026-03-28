import { serverSupabaseServiceRole } from '#supabase/server'

export type FulfillmentMode = 'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'

type PlatformOperationSettings = {
  disabledFulfillmentModes: FulfillmentMode[]
  testOverrideHosts: string[]
  testOverrideShopIds: string[]
}

type RawSettingsRow = {
  disabled_fulfillment_modes: unknown
  test_override_hosts: unknown
  test_override_shop_ids: unknown
}

const SETTINGS_TABLE = 'platform_operation_settings'
const ALL_MODES: FulfillmentMode[] = ['delivery', 'pickup', 'dine-in', 'qr-menu', 'showcase-order']

function normalizeModes(input: unknown): FulfillmentMode[] {
  if (!Array.isArray(input)) return []
  const items = input
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is FulfillmentMode => ALL_MODES.includes(item as FulfillmentMode))
  return Array.from(new Set(items))
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
}

function getHost(event: any): string {
  const xfHost = typeof event?.node?.req?.headers?.['x-forwarded-host'] === 'string'
    ? event.node.req.headers['x-forwarded-host']
    : ''
  const host = typeof event?.node?.req?.headers?.host === 'string'
    ? event.node.req.headers.host
    : ''
  return (xfHost || host || '').toLowerCase()
}

function hasTestOverride(event: any, shopId: string, settings: PlatformOperationSettings): boolean {
  const host = getHost(event)
  const hostMatched = settings.testOverrideHosts.some((allowed) => allowed && host.includes(allowed))
  const shopMatched = settings.testOverrideShopIds.includes(shopId)
  return hostMatched || shopMatched
}

export async function getPlatformOperationSettings(event: any): Promise<PlatformOperationSettings> {
  const client = await serverSupabaseServiceRole(event)
  const response = await client
    .from(SETTINGS_TABLE)
    .select('disabled_fulfillment_modes,test_override_hosts,test_override_shop_ids')
    .eq('id', 1)
    .maybeSingle<RawSettingsRow>()

  const row = response.data
  return {
    disabledFulfillmentModes: normalizeModes(row?.disabled_fulfillment_modes),
    testOverrideHosts: normalizeStringArray(row?.test_override_hosts),
    testOverrideShopIds: normalizeStringArray(row?.test_override_shop_ids),
  }
}

export async function applyGlobalFulfillmentPolicy(
  event: any,
  shopId: string,
  requested: FulfillmentMode[],
): Promise<FulfillmentMode[]> {
  const settings = await getPlatformOperationSettings(event)
  if (hasTestOverride(event, shopId, settings)) return requested
  const disabled = new Set(settings.disabledFulfillmentModes)
  const result = requested.filter((mode) => !disabled.has(mode))
  return result
}
