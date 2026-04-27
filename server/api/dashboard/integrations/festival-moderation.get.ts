import { defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: festivalLinks } = await client
    .from('restaurants')
    .select('festival_id')
    .eq('shop_id', access.shopId)
    .not('festival_id', 'is', null)

  const festivalIds = Array.from(new Set((festivalLinks ?? []).map((x: any) => String(x.festival_id || '')).filter(Boolean)))
  let festivals: Array<{ id: string; slug: string; name: string }> = []
  if (festivalIds.length) {
    const { data } = await client
      .from('festivals')
      .select('id,slug,name')
      .in('id', festivalIds)
      .order('starts_at', { ascending: false })
    festivals = (data ?? []).map((x: any) => ({
      id: String(x.id),
      slug: String(x.slug || ''),
      name: String(x.name || x.slug || 'Festival'),
    }))
  }

  const { data: chats } = await client
    .from('festival_moderation_chats')
    .select('id,festival_id,telegram_chat_id,max_chat_id,is_active,updated_at')
    .eq('shop_id', access.shopId)
    .order('updated_at', { ascending: false })

  return {
    ok: true,
    festivals,
    chats: (chats ?? []).map((x: any) => ({
      id: String(x.id),
      festivalId: String(x.festival_id),
      telegramChatId: x.telegram_chat_id || '',
      maxChatId: x.max_chat_id || '',
      isActive: x.is_active !== false,
      updatedAt: String(x.updated_at || ''),
    })),
  }
})
