import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolveShopIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  // `AppHeader` calls this endpoint from the browser without a tenant context.
  // MVP: fallback to resolving `shop_id` from headers/query/telegram init-data.
  const tenantShopId = (event.context.tenant?.shopId as string | undefined)
    || await resolveShopIdFromEvent(event)
  if (!tenantShopId) return { ok: true, items: [] }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('cities(id,name,slug)')
    .eq('shop_id', tenantShopId)
    .eq('is_active', true)

  if (error) {
    return { ok: true, items: [] }
  }

  const seen = new Set<string>()
  const items: Array<{ id: string; name: string; slug: string }> = []
  for (const row of data ?? []) {
    const city = (row as any)?.cities
    const slug = typeof city?.slug === 'string' ? city.slug.trim() : ''
    const id = typeof city?.id === 'string' ? city.id : ''
    const name = typeof city?.name === 'string' ? city.name : slug
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    items.push({ id, name, slug })
  }

  return { ok: true, items }
})
