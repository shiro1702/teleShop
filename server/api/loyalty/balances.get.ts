import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export type LoyaltyBalanceListItem = {
  shopId: string
  balance: number
  shopName: string
  tenantSlug: string
  citySlug: string
}

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const raw = supabaseUser as any
  const userId =
    typeof raw.id === 'string' ? raw.id : typeof raw.sub === 'string' ? raw.sub : null
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const qRaw = typeof query.q === 'string' ? query.q.trim() : ''
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(String(query.pageSize ?? '10'), 10) || 10))

  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)
  const defaultCitySlug =
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'

  const { data: balanceRows, error: balErr } = await client
    .from('shop_customer_balances')
    .select('shop_id, balance')
    .eq('customer_profile_id', userId)
    .gt('balance', 0)

  if (balErr) {
    console.error('loyalty/balances shop_customer_balances', balErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load balances' })
  }

  const rows = Array.isArray(balanceRows) ? balanceRows : []
  if (rows.length === 0) {
    return {
      ok: true as const,
      items: [] as LoyaltyBalanceListItem[],
      total: 0,
      page,
      pageSize,
    }
  }

  const shopIds = [...new Set(rows.map((r: { shop_id: string }) => r.shop_id))]

  const { data: shops, error: shopErr } = await client
    .from('shops')
    .select('id, name, slug')
    .in('id', shopIds)

  if (shopErr) {
    console.error('loyalty/balances shops', shopErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load shops' })
  }

  const shopList = Array.isArray(shops) ? shops : []
  const shopMap = new Map(shopList.map((s: { id: string; name: string; slug: string }) => [s.id, s]))

  const { data: rests } = await client
    .from('restaurants')
    .select('shop_id, cities(slug)')
    .in('shop_id', shopIds)
    .eq('is_active', true)

  const cityByShop = new Map<string, string>()
  for (const r of Array.isArray(rests) ? rests : []) {
    const row = r as { shop_id: string; cities?: { slug?: string } | null }
    if (cityByShop.has(row.shop_id)) continue
    const cs = row.cities?.slug
    if (typeof cs === 'string' && cs.trim()) {
      cityByShop.set(row.shop_id, cs.trim())
    }
  }

  let items: LoyaltyBalanceListItem[] = rows
    .map((row: { shop_id: string; balance: number }) => {
      const shop = shopMap.get(row.shop_id)
      if (!shop) return null
      const tenantSlug = typeof shop.slug === 'string' ? shop.slug.trim() : ''
      if (!tenantSlug) return null
      return {
        shopId: row.shop_id,
        balance: row.balance,
        shopName: shop.name,
        tenantSlug,
        citySlug: cityByShop.get(row.shop_id) || defaultCitySlug,
      }
    })
    .filter((x): x is LoyaltyBalanceListItem => x !== null)

  if (qRaw) {
    const low = qRaw.toLowerCase()
    items = items.filter((i) => i.shopName.toLowerCase().includes(low))
  }

  items.sort((a, b) => a.shopName.localeCompare(b.shopName, 'ru'))

  const total = items.length
  const start = (page - 1) * pageSize
  const slice = items.slice(start, start + pageSize)

  return {
    ok: true as const,
    items: slice,
    total,
    page,
    pageSize,
  }
})
