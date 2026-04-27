import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: campaigns, error } = await client
    .from('story_campaigns')
    .select('id, title, preview_url, placement, is_active, valid_from, valid_until, targeting, created_at')
    .eq('shop_id', access.shopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('dashboard stories campaigns list:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load story campaigns' })
  }

  const ids = (campaigns ?? []).map((c: { id: string }) => c.id)
  const slideCountByCampaign = new Map<string, number>()
  if (ids.length) {
    const { data: slides, error: sErr } = await client
      .from('story_slides')
      .select('campaign_id')
      .in('campaign_id', ids)

    if (sErr) {
      console.error('dashboard stories slides:', sErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load story slides' })
    }

    for (const s of slides ?? []) {
      const cid = (s as { campaign_id: string }).campaign_id
      slideCountByCampaign.set(cid, (slideCountByCampaign.get(cid) ?? 0) + 1)
    }
  }

  return {
    ok: true,
    items: (campaigns ?? []).map((row: any) => {
      return {
        id: row.id,
        title: row.title,
        previewUrl: row.preview_url,
        placement: row.placement,
        isActive: row.is_active,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        targeting: row.targeting ?? {},
        createdAt: row.created_at,
        slides: Array.from({ length: slideCountByCampaign.get(row.id) ?? 0 }, () => ({})),
      }
    }),
  }
})
