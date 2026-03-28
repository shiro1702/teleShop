import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data: groups, error: groupsError } = await client
    .from('modifier_groups')
    .select('id, name, selection_type, is_required, min_select, max_select, is_active, sort_order, external_id, created_at')
    .eq('shop_id', access.shopId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (groupsError) {
    console.error('Failed to load modifier groups:', groupsError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load modifier groups' })
  }

  const groupIds = (groups ?? []).map(g => g.id)
  
  let options: any[] = []
  if (groupIds.length > 0) {
    const { data: optionsData, error: optionsError } = await client
      .from('modifier_options')
      .select('id, group_id, name, pricing_type, price_delta, price_multiplier, is_default, is_active, sort_order, external_id')
      .in('group_id', groupIds)
      .order('sort_order', { ascending: true })

    if (!optionsError && optionsData) {
      options = optionsData
    }
  }

  return {
    ok: true,
    items: (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      selectionType: g.selection_type,
      isRequired: g.is_required,
      minSelect: g.min_select,
      maxSelect: g.max_select,
      isActive: g.is_active,
      sortOrder: g.sort_order,
      externalId: g.external_id,
      createdAt: g.created_at,
      options: options.filter(o => o.group_id === g.id).map(o => ({
        id: o.id,
        name: o.name,
        pricingType: o.pricing_type || 'delta',
        priceDelta: o.price_delta ?? 0,
        priceMultiplier: o.price_multiplier,
        isDefault: o.is_default,
        isActive: o.is_active,
        sortOrder: o.sort_order,
        externalId: o.external_id
      }))
    }))
  }
})
