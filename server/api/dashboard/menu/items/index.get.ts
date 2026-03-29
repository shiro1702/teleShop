import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('products')
    .select(`
      id, name, price, image, description, category_id, is_active, sort_order, external_id, created_at, 
      categories(id, name, category_modifier_groups(group_id), category_parameter_kinds(parameter_kind_id)),
      product_modifier_groups(group_id),
      product_modifier_group_overrides(group_id, is_disabled, disabled_option_ids),
      product_parameter_kinds(parameter_kind_id, is_required),
      product_parameter_option_overrides(option_id, price, is_disabled, is_default)
    `)
    .eq('shop_id', access.shopId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load items:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load items' })
  }

  return {
    ok: true,
    items: (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      image: row.image,
      description: row.description,
      categoryId: row.category_id,
      categoryName: row.categories?.name,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      externalId: row.external_id,
      createdAt: row.created_at,
      modifierGroupIds: row.product_modifier_groups?.map((g: any) => g.group_id) || [],
      categoryModifierGroupIds: row.categories?.category_modifier_groups?.map((g: any) => g.group_id) || [],
      modifierOverrides: Object.fromEntries(
        (row.product_modifier_group_overrides || []).map((override: any) => [
          override.group_id,
          {
            isDisabled: !!override.is_disabled,
            disabledOptionIds: Array.isArray(override.disabled_option_ids) ? override.disabled_option_ids : []
          }
        ])
      ),
      parameterKinds: row.product_parameter_kinds?.map((pk: any) => ({
        parameterKindId: pk.parameter_kind_id,
        isRequired: pk.is_required
      })) || [],
      categoryParameterKindIds: row.categories?.category_parameter_kinds?.map((pk: any) => pk.parameter_kind_id) || [],
      parameterOptionOverrides: Object.fromEntries(
        (row.product_parameter_option_overrides || []).map((override: any) => [
          override.option_id,
          {
            price: override.price,
            isDisabled: override.is_disabled,
            isDefault: override.is_default
          }
        ])
      )
    }))
  }
})
