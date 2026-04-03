import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type SlideInput = {
  id?: string
  mediaUrl?: string
  durationSeconds?: number
  actionType?: string
  actionPayload?: Record<string, unknown>
  sortOrder?: number
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const body = await readBody(event)

  const { data: existing, error: exErr } = await client
    .from('story_campaigns')
    .select('id')
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load campaign' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body?.title === 'string') patch.title = body.title.trim()
  if (body?.previewUrl === null) patch.preview_url = null
  else if (typeof body?.previewUrl === 'string') patch.preview_url = body.previewUrl.trim() || null
  if (body?.placement === 'top_bar' || body?.placement === 'catalog_grid') patch.placement = body.placement
  if (typeof body?.isActive === 'boolean') patch.is_active = body.isActive
  if ('validFrom' in body) patch.valid_from = body.validFrom
  if ('validUntil' in body) patch.valid_until = body.validUntil
  if (body?.targeting && typeof body.targeting === 'object') patch.targeting = body.targeting

  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString()
    const { error: upErr } = await client.from('story_campaigns').update(patch).eq('id', id)
    if (upErr) {
      console.error('update story campaign:', upErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to update campaign' })
    }
  }

  if (Array.isArray(body?.slides)) {
    const slides: SlideInput[] = body.slides
    const { data: oldSlides } = await client
      .from('story_slides')
      .select('id')
      .eq('campaign_id', id)

    const oldIds = new Set((oldSlides ?? []).map((r: any) => r.id as string))
    const nextIds = new Set(slides.map((s) => s.id).filter((x): x is string => typeof x === 'string'))

    for (const oid of oldIds) {
      if (!nextIds.has(oid)) {
        await client.from('story_slides').delete().eq('id', oid)
      }
    }

    let idx = 0
    for (const s of slides) {
      const sortOrder = typeof s.sortOrder === 'number' ? s.sortOrder : idx
      const durationSeconds =
        typeof s.durationSeconds === 'number' && s.durationSeconds >= 1
          ? Math.min(120, s.durationSeconds)
          : 5
      const actionType = normalizeActionType(s.actionType)
      const actionPayload = s.actionPayload && typeof s.actionPayload === 'object' ? s.actionPayload : {}
      const mediaUrl = typeof s.mediaUrl === 'string' ? s.mediaUrl : ''

      if (!mediaUrl) {
        throw createError({ statusCode: 400, statusMessage: 'Each slide needs mediaUrl' })
      }

      if (s.id && oldIds.has(s.id)) {
        const { error: u } = await client
          .from('story_slides')
          .update({
            sort_order: sortOrder,
            media_url: mediaUrl,
            duration_seconds: durationSeconds,
            action_type: actionType,
            action_payload: actionPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', s.id)
          .eq('campaign_id', id)
        if (u) {
          console.error('update slide:', u)
          throw createError({ statusCode: 500, statusMessage: 'Failed to update slide' })
        }
      } else {
        const { error: ins } = await client.from('story_slides').insert({
          campaign_id: id,
          sort_order: sortOrder,
          media_url: mediaUrl,
          duration_seconds: durationSeconds,
          action_type: actionType,
          action_payload: actionPayload,
        })
        if (ins) {
          console.error('insert slide:', ins)
          throw createError({ statusCode: 500, statusMessage: 'Failed to insert slide' })
        }
      }
      idx++
    }
  }

  return { ok: true }
})

function normalizeActionType(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : 'none'
  if (['add_to_cart', 'apply_promo', 'open_category', 'none'].includes(s)) return s
  return 'none'
}
