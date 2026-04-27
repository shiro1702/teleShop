import { createError, defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can access city moderation panel' })
  }

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status.trim() : 'pending'
  const cityId = typeof query.city_id === 'string' ? query.city_id.trim() : ''
  const festivalId = typeof query.festival_id === 'string' ? query.festival_id.trim() : ''
  const kind = typeof query.kind === 'string' ? query.kind.trim() : ''
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 300)

  const client = await serverSupabaseServiceRole(event)

  const { data: restaurants } = await client
    .from('restaurants')
    .select('id,city_id,name')
    .eq('shop_id', access.shopId)
  const restaurantRows = (restaurants ?? []) as Array<{ id: string; city_id: string | null; name: string }>
  const restaurantIds = restaurantRows.map((x) => x.id)
  const cityIds = Array.from(new Set(restaurantRows.map((x) => x.city_id).filter((x): x is string => !!x)))

  const { data: cities } = cityIds.length
    ? await client.from('cities').select('id,name').in('id', cityIds)
    : { data: [] as Array<{ id: string; name: string }> }
  const cityById = new Map((cities ?? []).map((x: any) => [String(x.id), String(x.name || '—')]))
  const restaurantById = new Map(restaurantRows.map((x) => [x.id, x]))

  let dbQuery = client
    .from('festival_ugc_submissions')
    .select('id,festival_id,shop_id,restaurant_id,order_id,kind,rating,category,media_url,status,publish_to_menu,publish_to_feed,created_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') dbQuery = dbQuery.eq('status', status)
  if (festivalId) dbQuery = dbQuery.eq('festival_id', festivalId)
  if (kind && kind !== 'all') dbQuery = dbQuery.eq('kind', kind)

  const { data: submissions, error } = await dbQuery
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to load city moderation queue' })
  }

  const festivalIds = Array.from(new Set((submissions ?? []).map((x: any) => String(x.festival_id || '')).filter(Boolean)))
  const { data: festivals } = festivalIds.length
    ? await client.from('festivals').select('id,slug,name').in('id', festivalIds)
    : { data: [] as Array<{ id: string; slug: string; name: string }> }
  const festivalById = new Map((festivals ?? []).map((x: any) => [String(x.id), { name: String(x.name || ''), slug: String(x.slug || '') }]))

  const items = (submissions ?? [])
    .map((x: any) => {
      const restaurant = restaurantById.get(String(x.restaurant_id || ''))
      const city = restaurant?.city_id ? cityById.get(restaurant.city_id) || '—' : '—'
      return {
        id: String(x.id),
        festivalId: String(x.festival_id || ''),
        festivalName: festivalById.get(String(x.festival_id || ''))?.name || 'Фестиваль',
        festivalSlug: festivalById.get(String(x.festival_id || ''))?.slug || '',
        restaurantId: x.restaurant_id ? String(x.restaurant_id) : '',
        restaurantName: restaurant?.name || '—',
        cityId: restaurant?.city_id || '',
        cityName: city,
        orderId: x.order_id ? String(x.order_id) : null,
        kind: x.kind === 'story' ? 'story' : 'video_review',
        rating: typeof x.rating === 'number' ? x.rating : null,
        category: x.category || null,
        mediaUrl: String(x.media_url || ''),
        status: String(x.status || 'pending'),
        publishToMenu: x.publish_to_menu === true,
        publishToFeed: x.publish_to_feed === true,
        createdAt: String(x.created_at || ''),
      }
    })
    .filter((x) => (cityId ? x.cityId === cityId : true))

  return {
    ok: true,
    filters: {
      cities: cityIds.map((id) => ({ id, name: cityById.get(id) || id })),
      festivals: (festivals ?? []).map((x: any) => ({ id: String(x.id), name: String(x.name || 'Фестиваль'), slug: String(x.slug || '') })),
    },
    items,
  }
})
