import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { assertValidTimeWindows } from '~/server/utils/menuAvailability'

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
  if (body.price !== undefined) {
    if (body.price < 0) throw createError({ statusCode: 400, statusMessage: 'Price must be >= 0' })
    updates.price = body.price
  }
  if (body.image !== undefined) updates.image = body.image
  if (body.description !== undefined) updates.description = body.description
  if (body.categoryId !== undefined) updates.category_id = body.categoryId
  if (body.isActive !== undefined) updates.is_active = body.isActive
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder
  if (body.externalId !== undefined) updates.external_id = body.externalId || null
  if (body.deliveryRestrictedOverride !== undefined) {
    updates.delivery_restricted_override =
      body.deliveryRestrictedOverride === null ? null : !!body.deliveryRestrictedOverride
  }
  if (body.availabilityWindows !== undefined) updates.availability_windows = assertValidTimeWindows(body.availabilityWindows)

  const { data, error } = await client
    .from('products')
    .update(updates)
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select('id, name, price, image, description, category_id, is_active, sort_order, external_id, delivery_restricted_override, availability_windows, created_at')
    .single()

  if (error) {
    console.error('Failed to update item:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update item' })
  }

  if (body.modifierGroupIds !== undefined && Array.isArray(body.modifierGroupIds)) {
    // Delete existing links
    await client
      .from('product_modifier_groups')
      .delete()
      .eq('product_id', id)
      
    // Insert new links
    if (body.modifierGroupIds.length > 0) {
      const modifierLinks = body.modifierGroupIds.map((groupId: string) => ({
        product_id: id,
        group_id: groupId
      }))
      
      const { error: linkError } = await client
        .from('product_modifier_groups')
        .insert(modifierLinks)
        
      if (linkError) {
        console.error('Failed to link modifiers to item:', linkError)
      }
    }
  }

  if (body.modifierOverrides !== undefined && body.modifierOverrides && typeof body.modifierOverrides === 'object') {
    const overrideEntries = Object.entries(body.modifierOverrides)
      .filter(([groupId]) => !!groupId)
      .map(([groupId, value]: [string, any]) => ({
        product_id: id,
        group_id: groupId,
        is_disabled: !!value?.isDisabled,
        disabled_option_ids: Array.isArray(value?.disabledOptionIds) ? value.disabledOptionIds : [],
        updated_at: new Date().toISOString()
      }))

    await client
      .from('product_modifier_group_overrides')
      .delete()
      .eq('product_id', id)

    if (overrideEntries.length > 0) {
      const { error: overridesError } = await client
        .from('product_modifier_group_overrides')
        .upsert(overrideEntries, { onConflict: 'product_id,group_id' })

      if (overridesError) {
        console.error('Failed to save modifier overrides:', overridesError)
      }
    }
  }

  // Update parameter kinds
  if (body.parameterKinds !== undefined && Array.isArray(body.parameterKinds)) {
    await client
      .from('product_parameter_kinds')
      .delete()
      .eq('product_id', id)

    if (body.parameterKinds.length > 0) {
      const pkToInsert = body.parameterKinds.map((pk: any) => ({
        product_id: id,
        parameter_kind_id: pk.parameterKindId,
        is_required: pk.isRequired ?? true
      }))

      const { error: pkError } = await client
        .from('product_parameter_kinds')
        .insert(pkToInsert)

      if (pkError) {
        console.error('Failed to update product parameter kinds:', pkError)
      }
    }
  }

  // Update parameter option overrides
  if (body.parameterOptionOverrides !== undefined && Array.isArray(body.parameterOptionOverrides)) {
    await client
      .from('product_parameter_option_overrides')
      .delete()
      .eq('product_id', id)

    if (body.parameterOptionOverrides.length > 0) {
      const overridesToInsert = body.parameterOptionOverrides.map((ov: any) => ({
        product_id: id,
        option_id: ov.optionId,
        price: ov.price,
        is_disabled: ov.isDisabled ?? false,
        is_default: ov.isDefault ?? false
      }))

      const { error: ovError } = await client
        .from('product_parameter_option_overrides')
        .insert(overridesToInsert)

      if (ovError) {
        console.error('Failed to update parameter option overrides:', ovError)
      }
    }
  }

  return {
    ok: true,
    item: {
      id: data.id,
      name: data.name,
      price: data.price,
      image: data.image,
      description: data.description,
      categoryId: data.category_id,
      isActive: data.is_active,
      sortOrder: data.sort_order,
      externalId: data.external_id,
      deliveryRestrictedOverride: data.delivery_restricted_override === null ? null : !!data.delivery_restricted_override,
      availabilityWindows: Array.isArray(data.availability_windows) ? data.availability_windows : [],
      createdAt: data.created_at
    }
  }
})
