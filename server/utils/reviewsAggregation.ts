import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { averageRatingsFromRows } from '~/utils/reviewRatingAverage'

export type PublicRatingResult = {
  public_rating: number | null
  sample_count: number
  formula: string
}

export type InternalQualityResult = {
  internal_quality_score: number | null
  sample_count: number
}

export async function computePublicRating(event: H3Event, args: {
  shopId: string
  restaurantId?: string | null
  sampleLimit?: number
}): Promise<PublicRatingResult> {
  const limit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 50)
  const client = await serverSupabaseServiceRole(event)
  let q = client
    .from('shop_reviews')
    .select('rating,published_at')
    .eq('shop_id', args.shopId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (args.restaurantId) q = q.eq('restaurant_id', args.restaurantId)

  const { data, error } = await q
  if (error) return {
    public_rating: null,
    sample_count: 0,
    formula: 'Рейтинг рассчитан по последним 20 опубликованным отзывам',
  }
  const rows = (data ?? []) as Array<{ rating: number | null }>
  const { average, count } = averageRatingsFromRows(rows)
  if (!count) {
    return {
      public_rating: null,
      sample_count: 0,
      formula: 'Рейтинг рассчитан по последним 20 опубликованным отзывам',
    }
  }
  return {
    public_rating: average,
    sample_count: count,
    formula: 'Рейтинг рассчитан по последним 20 опубликованным отзывам',
  }
}

export async function computeInternalQualityScore(event: H3Event, args: {
  shopId: string
  restaurantId?: string | null
  sampleLimit?: number
}): Promise<InternalQualityResult> {
  const limit = Math.min(Math.max(args.sampleLimit ?? 20, 1), 100)
  const client = await serverSupabaseServiceRole(event)
  let q = client
    .from('shop_reviews')
    .select('rating,created_at')
    .eq('shop_id', args.shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (args.restaurantId) q = q.eq('restaurant_id', args.restaurantId)

  const { data, error } = await q
  if (error) return { internal_quality_score: null, sample_count: 0 }
  const rows = (data ?? []) as Array<{ rating: number | null }>
  const { average, count } = averageRatingsFromRows(rows)
  if (!count) return { internal_quality_score: null, sample_count: 0 }
  return {
    internal_quality_score: average,
    sample_count: count,
  }
}
