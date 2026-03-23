import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type ShopRow = {
  id: string
  slug: string
  name: string
  ui_settings: Record<string, unknown> | null
  is_active: boolean
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('shops')
    .select('id,slug,name,ui_settings,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load shops:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants list' })
  }

  const rows = (data ?? []) as ShopRow[]
  return {
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      logoUrl: typeof row.ui_settings?.logo_url === 'string' ? row.ui_settings?.logo_url : null,
      description: typeof row.ui_settings?.description === 'string' ? row.ui_settings?.description : null,
    })),
  }
})

