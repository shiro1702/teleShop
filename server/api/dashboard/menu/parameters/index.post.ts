import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  if (!body.name || !body.code) {
    throw createError({ statusCode: 400, statusMessage: 'Name and code are required' })
  }

  const { data, error } = await client
    .from('parameter_kinds')
    .insert({
      shop_id: access.shopId,
      name: body.name,
      code: body.code,
      sort_order: body.sort_order || 0
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create parameter kind:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create parameter kind' })
  }

  if (body.options && Array.isArray(body.options) && body.options.length > 0) {
    const optionsToInsert = body.options.map((opt: any, index: number) => ({
      parameter_kind_id: data.id,
      name: opt.name,
      weight_g: opt.weight_g || null,
      volume_ml: opt.volume_ml || null,
      pieces: opt.pieces || null,
      is_active: opt.is_active !== false,
      sort_order: opt.sort_order ?? index,
      external_id: opt.external_id || null
    }))

    const { error: optionsError } = await client
      .from('parameter_options')
      .insert(optionsToInsert)

    if (optionsError) {
      console.error('Failed to create parameter options:', optionsError)
    }
  }

  return { ok: true, item: data }
})
