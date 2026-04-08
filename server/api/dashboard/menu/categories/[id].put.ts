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
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder
  if (body.isActive !== undefined) updates.is_active = body.isActive
  if (body.externalId !== undefined) updates.external_id = body.externalId || null
  if (body.deliveryRestricted !== undefined) updates.delivery_restricted = !!body.deliveryRestricted
  if (body.availabilityWindows !== undefined) updates.availability_windows = assertValidTimeWindows(body.availabilityWindows)

  const { data, error } = await client
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('shop_id', access.shopId)
    .select('id, name, sort_order, is_active, external_id, delivery_restricted, availability_windows, created_at')
    .single()

  if (error) {
    console.error('Failed to update category:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update category' })
  }

  if (body.modifierGroupIds !== undefined && Array.isArray(body.modifierGroupIds)) {
    // Delete existing links
    await client
      .from('category_modifier_groups')
      .delete()
      .eq('category_id', id)
      
    // Insert new links
    if (body.modifierGroupIds.length > 0) {
      const modifierLinks = body.modifierGroupIds.map((groupId: string) => ({
        category_id: id,
        group_id: groupId
      }))
      
      const { error: linkError } = await client
        .from('category_modifier_groups')
        .insert(modifierLinks)
        
      if (linkError) {
        console.error('Failed to link modifiers to category:', linkError)
      }
    }
  }

  if (body.parameterKindIds !== undefined && Array.isArray(body.parameterKindIds)) {
    // Delete existing links
    await client
      .from('category_parameter_kinds')
      .delete()
      .eq('category_id', id)
      
    // Insert new links
    if (body.parameterKindIds.length > 0) {
      const parameterLinks = body.parameterKindIds.map((kindId: string) => ({
        category_id: id,
        parameter_kind_id: kindId,
        is_required: true
      }))
      
      const { error: linkError } = await client
        .from('category_parameter_kinds')
        .insert(parameterLinks)
        
      if (linkError) {
        console.error('Failed to link parameters to category:', linkError)
      }
    }
  }

  return {
    ok: true,
    item: {
      id: data.id,
      name: data.name,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      externalId: data.external_id,
      deliveryRestricted: !!data.delivery_restricted,
      availabilityWindows: Array.isArray(data.availability_windows) ? data.availability_windows : [],
      createdAt: data.created_at
    }
  }
})
