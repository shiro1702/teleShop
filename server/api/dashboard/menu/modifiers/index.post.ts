import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const name = body.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  if (!['single', 'multi', 'boolean'].includes(body.selectionType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid selection type' })
  }

  const { data: group, error: groupError } = await client
    .from('modifier_groups')
    .insert({
      shop_id: access.shopId,
      name,
      selection_type: body.selectionType,
      is_required: body.isRequired ?? false,
      min_select: body.minSelect ?? 0,
      max_select: body.maxSelect ?? null,
      is_active: body.isActive ?? true,
      sort_order: body.sortOrder ?? 0,
      external_id: body.externalId || null
    })
    .select('id, name, selection_type, is_required, min_select, max_select, is_active, sort_order, external_id, created_at')
    .single()

  if (groupError) {
    console.error('Failed to create modifier group:', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create modifier group' })
  }

  let options: any[] = []
  if (Array.isArray(body.options) && body.options.length > 0) {
    const optionsToInsert = body.options.map((o: any, index: number) => ({
      pricing_type: o.pricingType === 'multiplier' ? 'multiplier' : 'delta',
      price_multiplier:
        o.pricingType === 'multiplier' && Number.isFinite(Number(o.priceMultiplier)) && Number(o.priceMultiplier) > 0
          ? Number(o.priceMultiplier)
          : (o.pricingType === 'multiplier' ? 1 : null),
      group_id: group.id,
      name: o.name,
      price_delta: o.pricingType === 'multiplier' ? 0 : (o.priceDelta ?? 0),
      is_default: o.isDefault ?? false,
      is_active: o.isActive ?? true,
      sort_order: o.sortOrder ?? index,
      external_id: o.externalId || null
    }))

    const { data: optionsData, error: optionsError } = await client
      .from('modifier_options')
      .insert(optionsToInsert)
      .select('id, name, pricing_type, price_delta, price_multiplier, is_default, is_active, sort_order, external_id')

    if (!optionsError && optionsData) {
      options = optionsData.map(o => ({
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
      options
    }
  }
})
