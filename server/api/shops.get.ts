import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getStyleRecord } from '~/server/utils/organizationStyle'

type ShopRow = {
  id: string
  slug: string
  name: string
  ui_settings: Record<string, unknown> | null
  is_active: boolean
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig(event)
  const requestedCitySlug = typeof query.city_slug === 'string' ? query.city_slug.trim() : ''
  const defaultCitySlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug.trim() : ''
  const citySlug = requestedCitySlug || defaultCitySlug

  if (!citySlug) {
    throw createError({ statusCode: 400, message: 'city_slug is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data: cityData, error: cityError } = await client
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .maybeSingle()

  if (cityError) {
    console.error('Failed to resolve city slug:', cityError)
    throw createError({ statusCode: 500, message: 'Failed to resolve city' })
  }

  if (!cityData?.id) {
    return { ok: true, items: [] }
  }

  const cityId = cityData.id as string

  const { data, error } = await client
    .from('shops')
    .select('id,slug,name,ui_settings,is_active,restaurants!inner(city_id,is_active)')
    .eq('is_active', true)
    .eq('restaurants.city_id', cityId)
    .eq('restaurants.is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load shops:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants list' })
  }

  const rows = (data ?? []) as ShopRow[]
  // Join с `restaurants` может возвращать дубликаты одного и того же shop (по числу ресторанов/филиалов).
  // На странице города нужно показывать shop один раз.
  const seen = new Set<string>()
  const uniqueRows: ShopRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    uniqueRows.push(row)
  }

  // MVP: берём name/description/logo не из `shops.ui_settings`, а из `organization_style_settings`,
  // чтобы карточки на странице города отражали настройку бренда.
  const items = await Promise.all(uniqueRows.map(async (row) => {
    try {
      const record = await getStyleRecord(event, row.id)
      const cfg = record.config

      return {
        id: row.id,
        slug: row.slug,
        name: cfg.identity.name || row.name,
        logoUrl: cfg.identity.logoUrl || (typeof row.ui_settings?.logo_url === 'string' ? row.ui_settings?.logo_url : null),
        description: cfg.identity.shortDescription || (typeof row.ui_settings?.description === 'string' ? row.ui_settings?.description : null),
      }
    } catch {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: typeof row.ui_settings?.logo_url === 'string' ? row.ui_settings?.logo_url : null,
        description: typeof row.ui_settings?.description === 'string' ? row.ui_settings?.description : null,
      }
    }
  }))
  return {
    ok: true,
    items,
  }
})

