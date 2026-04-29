import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type Body = {
  tableNumber?: string
}

function buildQrSlug(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owner can manage tables' })
  }
  const branchId = getRouterParam(event, 'id')
  if (!branchId) throw createError({ statusCode: 400, statusMessage: 'Branch id is required' })

  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const tableNumber = typeof body.tableNumber === 'string' ? body.tableNumber.trim().slice(0, 64) : ''
  if (!tableNumber) throw createError({ statusCode: 400, statusMessage: 'tableNumber is required' })

  const client = await serverSupabaseServiceRole(event)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = buildQrSlug()
    const { data, error } = await client
      .from('restaurant_tables')
      .insert({
        shop_id: access.shopId,
        restaurant_id: branchId,
        table_number: tableNumber,
        qr_slug: slug,
        is_active: true,
      })
      .select('id,table_number,qr_slug,is_active,created_at,updated_at')
      .maybeSingle()
    if (!error && data) {
      return {
        ok: true,
        item: {
          id: String(data.id),
          tableNumber: String(data.table_number),
          qrSlug: String(data.qr_slug),
          isActive: data.is_active === true,
          createdAt: String(data.created_at),
          updatedAt: String(data.updated_at),
        },
      }
    }
    if (error && error.code !== '23505') {
      throw createError({ statusCode: 400, statusMessage: error.message || 'Failed to create table' })
    }
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to generate unique QR slug' })
})
