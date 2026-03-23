import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig(event)
  const requestedSlug = typeof query.slug === 'string' ? query.slug.trim() : ''
  const defaultSlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug.trim() : ''
  const slug = requestedSlug || defaultSlug

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'City slug is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('cities')
    .select('id,name,slug,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Failed to load city by slug:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load city' })
  }

  const city = data as CityRow | null
  if (!city) {
    return {
      ok: true,
      city: null,
    }
  }

  return {
    ok: true,
    city: {
      id: city.id,
      name: city.name,
      slug: city.slug,
      isActive: city.is_active,
    },
  }
})
