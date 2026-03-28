import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('cities')
    .select('id,name,slug,is_active,created_at')
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load platform cities:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load cities' })
  }

  const rows = (data ?? []) as CityRow[]
  return {
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  }
})
