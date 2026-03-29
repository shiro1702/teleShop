import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const id = event.context.params?.id
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const { data, error } = await client
    .from('parameter_kinds')
    .update({
      name: body.name,
      code: body.code,
      sort_order: body.sort_order,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update parameter kind:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update parameter kind' })
  }

  if (body.options && Array.isArray(body.options)) {
    // Basic sync: delete all and recreate
    await client.from('parameter_options').delete().eq('parameter_kind_id', id)
    
    if (body.options.length > 0) {
      const optionsToInsert = body.options.map((opt: any, index: number) => ({
        parameter_kind_id: id,
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
        console.error('Failed to update parameter options:', optionsError)
      }
    }
  }

  return { ok: true, item: data }
})
