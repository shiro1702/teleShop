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

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (body.name !== undefined) {
    const name = body.name?.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
    updates.name = name
  }
  if (body.selectionType !== undefined) {
    if (!['single', 'multi', 'boolean'].includes(body.selectionType)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid selection type' })
    }
    updates.selection_type = body.selectionType
  }
  if (body.isRequired !== undefined) updates.is_required = body.isRequired
  if (body.minSelect !== undefined) updates.min_select = body.minSelect
  if (body.maxSelect !== undefined) updates.max_select = body.maxSelect
  if (body.isActive !== undefined) updates.is_active = body.isActive
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder
  if (body.externalId !== undefined) updates.external_id = body.externalId || null

  const { data: group, error: groupError } = await client
    .from('modifier_groups')
    .update(updates)
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select('id, name, selection_type, is_required, min_select, max_select, is_active, sort_order, external_id, created_at')
    .single()

  if (groupError) {
    console.error('Failed to update modifier group:', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update modifier group' })
  }

  // Update options if provided
  if (Array.isArray(body.options)) {
    // For simplicity, we can delete existing and re-insert, or upsert.
    // Let's delete and re-insert for MVP.
    await client.from('modifier_options').delete().eq('group_id', id)

    if (body.options.length > 0) {
      const optionsToInsert = body.options.map((o: any, index: number) => ({
        pricing_type: o.pricingType === 'multiplier' ? 'multiplier' : 'delta',
        price_multiplier:
          o.pricingType === 'multiplier' && Number.isFinite(Number(o.priceMultiplier)) && Number(o.priceMultiplier) > 0
            ? Number(o.priceMultiplier)
            : (o.pricingType === 'multiplier' ? 1 : null),
        group_id: id,
        name: o.name,
        price_delta: o.pricingType === 'multiplier' ? 0 : (o.priceDelta ?? 0),
        is_default: o.isDefault ?? false,
        is_active: o.isActive ?? true,
        sort_order: o.sortOrder ?? index,
        external_id: o.externalId || null
      }))
      await client.from('modifier_options').insert(optionsToInsert)
    }
  }

  // Fetch updated options
  const { data: optionsData } = await client
    .from('modifier_options')
    .select('id, name, pricing_type, price_delta, price_multiplier, is_default, is_active, sort_order, external_id')
    .eq('group_id', id)
    .order('sort_order', { ascending: true })

  return {
    ok: true,
    item: {
      id: group.id,
      name: group.name,
      selectionType: group.selection_type,
      isRequired: group.is_required,
      minSelect: group.min_select,
      maxSelect: group.max_select,
      isActive: group.is_active,
      sortOrder: group.sort_order,
      externalId: group.external_id,
      createdAt: group.created_at,
      options: (optionsData ?? []).map(o => ({
        id: o.id,
        name: o.name,
        pricingType: o.pricing_type,
        priceDelta: o.price_delta,
        priceMultiplier: o.price_multiplier,
        isDefault: o.is_default,
        isActive: o.is_active,
        sortOrder: o.sort_order,
        externalId: o.external_id
      }))
    }
  }
})
