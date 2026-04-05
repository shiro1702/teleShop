import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import {
  campaignMatchesTargeting,
  isTargetingEmpty,
  type ViewerContext,
} from '~/server/utils/storyTargeting'
import { buildDemoStoryCampaigns } from '~/server/utils/demoStories'

function normalizeUserId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id === 'string' && o.id) return o.id
  if (typeof o.sub === 'string' && o.sub) return o.sub
  return null
}

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const client = await serverSupabaseServiceRole(event)
  const supabaseUser = await serverSupabaseUser(event)
  const userId = normalizeUserId(supabaseUser)

  let viewer: ViewerContext = {
    userId,
    gender: null,
    birthDate: null,
    ordersCount: 0,
    daysSinceLastOrder: null,
  }

  if (userId) {
    const { data: profile } = await client
      .from('profiles')
      .select('gender, birth_date')
      .eq('id', userId)
      .maybeSingle()

    const gender =
      profile && typeof (profile as any).gender === 'string'
        ? ((profile as any).gender as string)
        : null
    const birthDate =
      profile && (profile as any).birth_date != null
        ? String((profile as any).birth_date).slice(0, 10)
        : null

    const { count: orderCount } = await client
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('customer_profile_id', userId)
      .neq('status', 'cancelled')

    const { data: lastOrder } = await client
      .from('orders')
      .select('created_at')
      .eq('shop_id', shopId)
      .eq('customer_profile_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let daysSinceLastOrder: number | null = null
    if (lastOrder?.created_at) {
      const last = new Date(lastOrder.created_at as string)
      const now = new Date()
      daysSinceLastOrder = Math.floor(
        (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000),
      )
    }

    viewer = {
      userId,
      gender,
      birthDate,
      ordersCount: orderCount ?? 0,
      daysSinceLastOrder,
    }
  }

  const nowIso = new Date().toISOString()

  const { data: campaigns, error: campErr } = await client
    .from('story_campaigns')
    .select(
      'id, shop_id, title, preview_url, placement, is_active, valid_from, valid_until, targeting, created_at',
    )
    .eq('shop_id', shopId)
    .eq('is_active', true)

  if (campErr) {
    console.error('stories.get campaigns:', campErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load stories' })
  }

  const timeOk = (c: unknown): boolean => {
    const row = c as Record<string, unknown>
    const vf = row.valid_from
    const vu = row.valid_until
    if (vf && typeof vf === 'string' && vf > nowIso) return false
    if (vu && typeof vu === 'string' && vu < nowIso) return false
    return true
  }

  const filtered = (campaigns ?? []).filter((c) => {
    if (!timeOk(c)) return false
    const targeting = (c as { targeting?: unknown }).targeting
    if (!userId) {
      return isTargetingEmpty(targeting)
    }
    return campaignMatchesTargeting(targeting, viewer)
  })

  const campaignIds = filtered.map((c) => (c as { id: string }).id)
  if (campaignIds.length === 0) {
    const allowDemo = import.meta.dev || process.env.STORIES_DEMO === '1'
    if (allowDemo) {
      const demo = buildDemoStoryCampaigns(shopId)
      const topBar = demo.filter((c) => c.placement === 'top_bar' && c.slides.length > 0)
      const catalogGrid = demo.filter((c) => c.placement === 'catalog_grid' && c.slides.length > 0)
      return {
        ok: true,
        shopId,
        topBar,
        catalogGrid,
        campaigns: demo,
      }
    }
    return {
      ok: true,
      shopId,
      topBar: [],
      catalogGrid: [],
      campaigns: [],
    }
  }

  const { data: slides, error: slideErr } = await client
    .from('story_slides')
    .select(
      'id, campaign_id, sort_order, media_url, duration_seconds, action_type, action_payload',
    )
    .in('campaign_id', campaignIds)
    .order('sort_order', { ascending: true })

  if (slideErr) {
    console.error('stories.get slides:', slideErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load story slides' })
  }

  const slidesByCampaign = new Map<string, typeof slides>()
  for (const s of slides ?? []) {
    const cid = (s as { campaign_id: string }).campaign_id
    if (!slidesByCampaign.has(cid)) slidesByCampaign.set(cid, [])
    slidesByCampaign.get(cid)!.push(s)
  }

  const mapSlide = (s: Record<string, unknown>) => ({
    id: s.id as string,
    campaignId: s.campaign_id as string,
    sortOrder: s.sort_order as number,
    mediaUrl: s.media_url as string,
    durationSeconds: s.duration_seconds as number,
    actionType: s.action_type as string,
    actionPayload: (s.action_payload ?? {}) as Record<string, unknown>,
  })

  const mapCampaign = (c: Record<string, unknown>) => {
    const id = c.id as string
    const rawSlides = slidesByCampaign.get(id) ?? []
    return {
      id,
      title: c.title as string,
      previewUrl: (c.preview_url as string | null) ?? null,
      placement: c.placement as string,
      targeting: c.targeting,
      slides: rawSlides.map((x) => mapSlide(x as Record<string, unknown>)),
    }
  }

  const mapped = filtered.map((c) => mapCampaign(c as Record<string, unknown>))

  const topBar = mapped.filter((c) => c.placement === 'top_bar' && c.slides.length > 0)
  const catalogGrid = mapped.filter((c) => c.placement === 'catalog_grid' && c.slides.length > 0)

  return {
    ok: true,
    shopId,
    topBar,
    catalogGrid,
    campaigns: mapped,
  }
})
