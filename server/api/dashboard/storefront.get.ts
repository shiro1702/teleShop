import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)
  const defaultCitySlug = typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
    ? config.public.defaultCitySlug.trim()
    : 'ulan-ude'

  const { data, error } = await client
    .from('shops')
    .select('slug')
    .eq('id', access.shopId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to resolve storefront path' })
  }

  const cityRes = await client
    .from('restaurants')
    .select('cities(slug)')
    .eq('shop_id', access.shopId)
    .eq('is_active', true)
    .limit(1)

  if (cityRes.error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to resolve storefront city' })
  }

  const firstRow = Array.isArray(cityRes.data) ? cityRes.data[0] as any : null
  const citySlug = typeof firstRow?.cities?.slug === 'string' && firstRow.cities.slug.trim()
    ? firstRow.cities.slug.trim()
    : defaultCitySlug
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : ''
  return {
    ok: true,
    path: slug ? `/${citySlug}/${slug}` : '/',
  }
})
