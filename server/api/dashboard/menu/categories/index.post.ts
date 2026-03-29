import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const name = body.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const { data, error } = await client
    .from('categories')
    .insert({
      shop_id: access.shopId,
      name,
      sort_order: body.sortOrder ?? 0,
      is_active: body.isActive ?? true,
      external_id: body.externalId || null
    })
    .select('id, name, sort_order, is_active, external_id, created_at')
    .single()

  if (error) {
    console.error('Failed to create category:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create category' })
  }

  if (body.modifierGroupIds && Array.isArray(body.modifierGroupIds) && body.modifierGroupIds.length > 0) {
    const modifierLinks = body.modifierGroupIds.map((groupId: string) => ({
      category_id: data.id,
      group_id: groupId
    }))
    
    const { error: linkError } = await client
      .from('category_modifier_groups')
      .insert(modifierLinks)
      
    if (linkError) {
      console.error('Failed to link modifiers to category:', linkError)
    }
  }

  if (body.parameterKindIds && Array.isArray(body.parameterKindIds) && body.parameterKindIds.length > 0) {
    const parameterLinks = body.parameterKindIds.map((kindId: string) => ({
      category_id: data.id,
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

  return {
    ok: true,
    item: {
      id: data.id,
      name: data.name,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      externalId: data.external_id,
      createdAt: data.created_at,
      productsCount: 0
    }
  }
})
