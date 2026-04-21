import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type SlideInput = {
  mediaUrl?: string
  durationSeconds?: number
  actionType?: string
  actionPayload?: Record<string, unknown>
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  const placement = body?.placement === 'catalog_grid' ? 'catalog_grid' : 'top_bar'
  const previewUrl =
    typeof body?.previewUrl === 'string' && body.previewUrl.trim()
      ? body.previewUrl.trim()
      : null
  const isActive = body?.isActive !== false
  const validFrom = body?.validFrom ?? null
  const validUntil = body?.validUntil ?? null
  const targeting =
    body?.targeting && typeof body.targeting === 'object' ? body.targeting : {}

  const { data: campaign, error: insErr } = await client
    .from('story_campaigns')
    .insert({
      shop_id: access.shopId,
      title,
      preview_url: previewUrl,
      placement,
      is_active: isActive,
      valid_from: validFrom,
      valid_until: validUntil,
      targeting,
    })
    .select('id')
    .single()

  if (insErr || !campaign?.id) {
    console.error('create story campaign:', insErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create campaign' })
  }

  const campaignId = campaign.id as string
  const slidesInput: SlideInput[] = Array.isArray(body?.slides) ? body.slides : []

  if (slidesInput.length) {
    const rows = slidesInput.map((s, idx) => ({
      campaign_id: campaignId,
      sort_order: typeof s.sortOrder === 'number' ? s.sortOrder : idx,
      media_url: typeof s.mediaUrl === 'string' ? s.mediaUrl.trim() : '',
      duration_seconds:
        typeof s.durationSeconds === 'number' && s.durationSeconds >= 1
          ? Math.min(120, s.durationSeconds)
          : 5,
      action_type: normalizeActionType(s.actionType),
      action_payload: s.actionPayload && typeof s.actionPayload === 'object' ? s.actionPayload : {},
    }))

    const { error: slideErr } = await client.from('story_slides').insert(rows)
    if (slideErr) {
      await client.from('story_campaigns').delete().eq('id', campaignId)
      console.error('create story slides:', slideErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to create slides' })
    }
  }

  return { ok: true, id: campaignId }
})

function normalizeActionType(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : 'none'
  if (['add_to_cart', 'apply_promo', 'open_category', 'none'].includes(s)) return s
  return 'none'
}
