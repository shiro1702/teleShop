import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const { data: row, error } = await client
    .from('story_campaigns')
    .select('id, title, preview_url, placement, is_active, valid_from, valid_until, targeting, created_at')
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load campaign' })
  }
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })
  }

  const { data: slideRows, error: sErr } = await client
    .from('story_slides')
    .select('id, sort_order, media_url, duration_seconds, action_type, action_payload')
    .eq('campaign_id', id)
    .order('sort_order', { ascending: true })

  if (sErr) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load slides' })
  }

  const slides = (slideRows ?? []).map((s: any) => ({
    id: s.id,
    sortOrder: s.sort_order,
    mediaUrl: s.media_url,
    durationSeconds: s.duration_seconds,
    actionType: s.action_type,
    actionPayload: s.action_payload ?? {},
  }))

  const r = row as any
  return {
    ok: true,
    item: {
      id: r.id,
      title: r.title,
      previewUrl: r.preview_url,
      placement: r.placement,
      isActive: r.is_active,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      targeting: r.targeting ?? {},
      createdAt: r.created_at,
      slides,
    },
  }
})
