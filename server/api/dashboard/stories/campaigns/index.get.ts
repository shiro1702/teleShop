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
  let slidesByCampaign = new Map<string, any[]>()
  if (ids.length) {
    const { data: slides, error: sErr } = await client
      .from('story_slides')
      .select('id, campaign_id, sort_order, media_url, duration_seconds, action_type, action_payload')
      .in('campaign_id', ids)
      .order('sort_order', { ascending: true })

    if (sErr) {
      console.error('dashboard stories slides:', sErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load story slides' })
    }

    for (const s of slides ?? []) {
      const cid = (s as { campaign_id: string }).campaign_id
      if (!slidesByCampaign.has(cid)) slidesByCampaign.set(cid, [])
      slidesByCampaign.get(cid)!.push(s)
    }
  }

  return {
    ok: true,
    items: (campaigns ?? []).map((row: any) => {
      const slides = (slidesByCampaign.get(row.id) ?? []).map((s: any) => ({
        id: s.id,
        sortOrder: s.sort_order,
        mediaUrl: s.media_url,
        durationSeconds: s.duration_seconds,
        actionType: s.action_type,
        actionPayload: s.action_payload ?? {},
      }))
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
        slides,
      }
    }),
  }
})
