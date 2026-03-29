import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('products')
    .select('id,name,price,image,description,category,category_id,sort_order,is_active,categories(name)')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load products by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load products' })
  }

  // Fetch modifiers for these products
  const productIds = (data ?? []).map(p => p.id)
  const categoryIds = [...new Set((data ?? []).map(p => p.category_id).filter(Boolean))]
  
  let modifiersMap: Record<string, any[]> = {}
  let parametersMap: Record<string, any[]> = {}
  
  if (productIds.length > 0) {
    // Fetch parameters
    const { data: parameterKinds } = await client
      .from('parameter_kinds')
      .select(`
        id, name, code, sort_order,
        parameter_options(id, name, weight_g, volume_ml, pieces, is_active, sort_order)
      `)
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true })

    const { data: productParameterKinds } = await client
      .from('product_parameter_kinds')
      .select('product_id, parameter_kind_id, is_required')
      .in('product_id', productIds)

    const { data: categoryParameterKinds } = await client
      .from('category_parameter_kinds')
      .select('category_id, parameter_kind_id, is_required')
      .in('category_id', categoryIds)

    const { data: parameterOverrides } = await client
      .from('product_parameter_option_overrides')
      .select('product_id, option_id, price, is_disabled, is_default')
      .in('product_id', productIds)

    if (parameterKinds) {
      // Pre-process parameter kinds for quick lookup
      const kindsMap = new Map(parameterKinds.map(k => [k.id, k]))
      
      // Group overrides by product_id -> option_id
      const overridesByProduct = new Map<string, Map<string, any>>()
      if (parameterOverrides) {
        parameterOverrides.forEach(ov => {
          if (!overridesByProduct.has(ov.product_id)) {
            overridesByProduct.set(ov.product_id, new Map())
          }
          overridesByProduct.get(ov.product_id)!.set(ov.option_id, ov)
        })
      }

      // Helper to build parameters for a product
      const buildProductParameters = (productId: string, categoryId: string | null) => {
        const productKinds = new Map<string, { isRequired: boolean }>()
        
        // Add inherited from category
        if (categoryId && categoryParameterKinds) {
          categoryParameterKinds
            .filter(cpk => cpk.category_id === categoryId)
            .forEach(cpk => productKinds.set(cpk.parameter_kind_id, { isRequired: cpk.is_required }))
        }

        // Add/override from product
        if (productParameterKinds) {
          productParameterKinds
            .filter(ppk => ppk.product_id === productId)
            .forEach(ppk => productKinds.set(ppk.parameter_kind_id, { isRequired: ppk.is_required }))
        }

        const productParams: any[] = []
        const productOverridesMap = overridesByProduct.get(productId)

        for (const [kindId, config] of productKinds.entries()) {
          const kind = kindsMap.get(kindId)
          if (!kind || !kind.parameter_options) continue

          const options = kind.parameter_options
            .map((opt: any) => {
              const override = productOverridesMap?.get(opt.id)
              
              // Only include options that have a price set (either base or override) and are not disabled
              const price = override?.price
              const isDisabled = override?.is_disabled || !opt.is_active
              
              if (price === undefined || price === null || isDisabled) {
                return null
              }

              return {
                id: opt.id,
                name: opt.name,
                price: price,
                weightG: opt.weight_g,
                volumeMl: opt.volume_ml,
                pieces: opt.pieces,
                isDefault: override?.is_default || false,
                sortOrder: opt.sort_order
              }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)

          if (options.length > 0) {
            productParams.push({
              id: kind.id, // Using kind.id as the parameter group ID for the frontend
              parameterKindId: kind.id,
              name: kind.name,
              isRequired: config.isRequired,
              options
            })
          }
        }

        return productParams
      }

      // Build for all products
      data?.forEach(product => {
        const params = buildProductParameters(product.id, product.category_id)
        if (params.length > 0) {
          parametersMap[product.id] = params
        }
      })
    }
  }

  if (productIds.length > 0 || categoryIds.length > 0) {
    // 1. Get product-group relations
    const { data: productGroups } = await client
      .from('product_modifier_groups')
      .select('product_id, group_id, is_required_override, min_select_override, max_select_override')
      .in('product_id', productIds)

    // 1.5 Get category-group relations
    const { data: categoryGroups } = await client
      .from('category_modifier_groups')
      .select('category_id, group_id')
      .in('category_id', categoryIds)

    // 1.75 Product-level overrides for inherited groups/options
    const { data: productOverrides } = await client
      .from('product_modifier_group_overrides')
      .select('product_id, group_id, is_disabled, disabled_option_ids')
      .in('product_id', productIds)

    const allGroupIds = new Set<string>()
    if (productGroups) productGroups.forEach(pg => allGroupIds.add(pg.group_id))
    if (categoryGroups) categoryGroups.forEach(cg => allGroupIds.add(cg.group_id))

    if (allGroupIds.size > 0) {
      const groupIds = Array.from(allGroupIds)
      
      // 2. Get groups
      const { data: groups } = await client
        .from('modifier_groups')
        .select('id, name, selection_type, is_required, min_select, max_select')
        .in('id', groupIds)
        .eq('is_active', true)
        
      // 3. Get options
      const { data: options } = await client
        .from('modifier_options')
        .select('id, group_id, name, pricing_type, price_delta, price_multiplier, is_default')
        .in('group_id', groupIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (groups && options) {
        const groupsMap = new Map(groups.map(g => [g.id, g]))
        const optionsByGroup = new Map<string, any[]>()
        const productOverridesMap = new Map<string, { isDisabled: boolean; disabledOptionIds: string[] }>()
        
        options.forEach(opt => {
          if (!optionsByGroup.has(opt.group_id)) optionsByGroup.set(opt.group_id, [])
          optionsByGroup.get(opt.group_id)!.push({
            id: opt.id,
            name: opt.name,
            pricingType: opt.pricing_type || 'delta',
            priceDelta: opt.price_delta ?? 0,
            priceMultiplier: opt.price_multiplier,
            isDefault: opt.is_default
          })
        })

        if (productOverrides) {
          productOverrides.forEach((row) => {
            productOverridesMap.set(`${row.product_id}:${row.group_id}`, {
              isDisabled: !!row.is_disabled,
              disabledOptionIds: Array.isArray(row.disabled_option_ids) ? row.disabled_option_ids : []
            })
          })
        }

        // Helper to format a group
        const formatGroup = (group: any, overrides: any = {}, disabledOptionIds: string[] = []) => {
          const options = (optionsByGroup.get(group.id) || []).filter(
            (opt) => !disabledOptionIds.includes(opt.id)
          )

          return {
            id: group.id,
            name: group.name,
            selectionType: group.selection_type,
            isRequired: overrides.is_required_override ?? group.is_required,
            minSelect: overrides.min_select_override ?? group.min_select,
            maxSelect: overrides.max_select_override ?? group.max_select,
            options
          }
        }

        // Map category modifiers to products
        if (categoryGroups) {
          data?.forEach(product => {
            if (!product.category_id) return
            const cGroups = categoryGroups.filter(cg => cg.category_id === product.category_id)
            cGroups.forEach(cg => {
              const group = groupsMap.get(cg.group_id)
              if (!group) return

              const override = productOverridesMap.get(`${product.id}:${cg.group_id}`)
              if (override?.isDisabled) return

              if (!modifiersMap[product.id]) modifiersMap[product.id] = []
              modifiersMap[product.id].push(formatGroup(group, {}, override?.disabledOptionIds || []))
            })
          })
        }

        // Assemble product-specific modifiers (overrides or additions)
        if (productGroups) {
          productGroups.forEach(pg => {
            const group = groupsMap.get(pg.group_id)
            if (!group) return
            
            if (!modifiersMap[pg.product_id]) modifiersMap[pg.product_id] = []

            const override = productOverridesMap.get(`${pg.product_id}:${pg.group_id}`)
            if (override?.isDisabled) return

            const existingIdx = modifiersMap[pg.product_id].findIndex(g => g.id === group.id)
            const formattedGroup = formatGroup(group, pg, override?.disabledOptionIds || [])
            
            if (existingIdx >= 0) {
              // Override the category one
              modifiersMap[pg.product_id][existingIdx] = formattedGroup
            } else {
              // Add new product-specific one
              modifiersMap[pg.product_id].push(formattedGroup)
            }
          })
        }
      }
    }
  }

  // Map the new categories relation to the old category string for backwards compatibility
  const items = (data ?? []).map((item: any) => {
    const params = parametersMap[item.id] || []
    // If there are parameters, base price is the minimum of active options
    let displayPrice = item.price
    if (params.length > 0 && params[0].options.length > 0) {
      displayPrice = Math.min(...params[0].options.map((o: any) => o.price))
    }

    return {
      ...item,
      price: displayPrice,
      category: item.categories?.name || item.category || 'Без категории',
      modifiers: modifiersMap[item.id] || [],
      parameters: params
    }
  })

  return {
    ok: true,
    shopId,
    items,
  }
})
