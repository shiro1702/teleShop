import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

type Body = {
  slideId?: string
}

function normalizeUserId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id === 'string' && o.id) return o.id
  if (typeof o.sub === 'string' && o.sub) return o.sub
  return null
}

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<Body>(event)
  const slideId = typeof body?.slideId === 'string' ? body.slideId.trim() : ''
  if (!slideId) {
    throw createError({ statusCode: 400, statusMessage: 'slideId is required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const supabaseUser = await serverSupabaseUser(event)
  const userId = normalizeUserId(supabaseUser)

  const { data: slideRow, error: slideErr } = await client
    .from('story_slides')
    .select('id, campaign_id')
    .eq('id', slideId)
    .maybeSingle()

  if (slideErr || !slideRow) {
    throw createError({ statusCode: 404, statusMessage: 'Slide not found' })
  }

  const { data: campaign, error: campErr } = await client
    .from('story_campaigns')
    .select('id, shop_id')
    .eq('id', (slideRow as { campaign_id: string }).campaign_id)
    .maybeSingle()

  if (campErr || !campaign || (campaign as { shop_id: string }).shop_id !== shopId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slide for this shop' })
  }

  const { error: insErr } = await client.from('story_views').insert({
    slide_id: slideId,
    user_id: userId,
    viewed_at: new Date().toISOString(),
  })

  if (insErr) {
    console.error('story_views insert:', insErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to record view' })
  }

  return { ok: true }
})
