import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type CityRow = {
  id: string
  name: string
  slug: string
  is_active?: boolean
}

type FestivalRow = {
  id: string
  slug: string
  name: string
  description: string | null
  pulse_stats: Record<string, unknown> | null
  schedule: unknown[] | null
  public_banner_lead_days: number | null
  starts_at: string | null
  ends_at: string | null
}

function canRetryWithLegacySchema(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code : ''
  return code === '42703' || code === '42P01' || code.startsWith('PGRST2')
}

export default defineEventHandler(async (event) => {
  // City metadata changes rarely; allow browser/CDN reuse.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600')
  const query = getQuery(event)
  const config = useRuntimeConfig(event)
  const requestedSlug = typeof query.slug === 'string' ? query.slug.trim() : ''
  const requestedFestivalSlug = typeof query.festival_slug === 'string' ? query.festival_slug.trim() : ''
  const defaultSlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug.trim() : ''
  const slug = requestedSlug || defaultSlug

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'City slug is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  let data: any = null
  let error: any = null
  const primary = await client
    .from('cities')
    .select('id,name,slug,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  data = primary.data
  error = primary.error

  if (error && canRetryWithLegacySchema(error)) {
    const fallback = await client
      .from('cities')
      .select('id,name,slug')
      .eq('slug', slug)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

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

  let festival: FestivalRow | null = null
  const { data: festivalRows } = await client
    .from('festivals')
    .select('id,slug,name,description,pulse_stats,schedule,public_banner_lead_days,starts_at,ends_at')
    .eq('city_id', city.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10)

  if (Array.isArray(festivalRows) && festivalRows.length) {
    const nowTs = Date.now()
    const current = requestedFestivalSlug
      ? festivalRows.find((row: any) => typeof row.slug === 'string' && row.slug.trim() === requestedFestivalSlug)
      : festivalRows.find((row: any) => {
          const startsAt = typeof row.starts_at === 'string' ? Date.parse(row.starts_at) : NaN
          const endsAt = typeof row.ends_at === 'string' ? Date.parse(row.ends_at) : NaN
          const leadDays = typeof row.public_banner_lead_days === 'number' ? row.public_banner_lead_days : 35
          const bannerStartsAt = Number.isNaN(startsAt) ? NaN : startsAt - leadDays * 24 * 60 * 60 * 1000
          const startsOk = Number.isNaN(bannerStartsAt) || bannerStartsAt <= nowTs
          const endsOk = Number.isNaN(endsAt) || endsAt >= nowTs
          return startsOk && endsOk
        })
    if (current?.id) {
      festival = current as FestivalRow
    }
  }

  return {
    ok: true,
    city: {
      id: city.id,
      name: city.name,
      slug: city.slug,
      isActive: city.is_active !== false,
    },
    festival: festival
      ? {
          id: festival.id,
          slug: festival.slug,
          name: festival.name,
          description: festival.description,
          pulseStats: festival.pulse_stats ?? {},
          schedule: Array.isArray(festival.schedule) ? festival.schedule : [],
        }
      : null,
  }
})
