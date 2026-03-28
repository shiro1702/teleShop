import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const name = body.name?.trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  if (body.price == null || body.price < 0) throw createError({ statusCode: 400, statusMessage: 'Valid price is required' })
  if (!body.categoryId) throw createError({ statusCode: 400, statusMessage: 'Category is required' })

  const { data, error } = await client
    .from('products')
    .insert({
      shop_id: access.shopId,
      name,
      price: body.price,
      image: body.image || '',
      description: body.description || null,
      category_id: body.categoryId,
      category: 'migrated', // fallback for old column
      is_active: body.isActive ?? true,
      sort_order: body.sortOrder ?? 0,
      external_id: body.externalId || null
    })
    .select('id, name, price, image, description, category_id, is_active, sort_order, external_id, created_at')
    .single()

  if (error) {
    console.error('Failed to create item:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to create item' })
  }

  if (body.modifierGroupIds && Array.isArray(body.modifierGroupIds) && body.modifierGroupIds.length > 0) {
    const modifierLinks = body.modifierGroupIds.map((groupId: string) => ({
      product_id: data.id,
      group_id: groupId
    }))
    
    const { error: linkError } = await client
      .from('product_modifier_groups')
      .insert(modifierLinks)
      
    if (linkError) {
      console.error('Failed to link modifiers to item:', linkError)
      // We don't throw here to not fail the whole request, but it's an error state
    }
  }

  if (body.modifierOverrides && typeof body.modifierOverrides === 'object') {
    const overrideRows = Object.entries(body.modifierOverrides)
      .filter(([groupId]) => !!groupId)
      .map(([groupId, value]: [string, any]) => ({
        product_id: data.id,
        group_id: groupId,
        is_disabled: !!value?.isDisabled,
        disabled_option_ids: Array.isArray(value?.disabledOptionIds) ? value.disabledOptionIds : [],
        updated_at: new Date().toISOString()
      }))

    if (overrideRows.length > 0) {
      const { error: overridesError } = await client
        .from('product_modifier_group_overrides')
        .upsert(overrideRows, { onConflict: 'product_id,group_id' })

      if (overridesError) {
        console.error('Failed to save modifier overrides:', overridesError)
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
      createdAt: data.created_at
    }
  }
})
