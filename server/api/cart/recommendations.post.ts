import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireRestaurantForShop, requireTenantShop } from '~/server/utils/tenant'
import { evaluateMenuAvailability, normalizeTimeWindows, type FulfillmentType } from '~/server/utils/menuAvailability'

type RecommendationSource = 'product_link' | 'category_link' | 'global_fallback'

type RequestBody = {
  restaurantId?: string
  fulfillmentType?: FulfillmentType
  cartProductIds?: string[]
  remainingToFreeDeliveryRub?: number | null
  limit?: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 6
  return Math.min(12, Math.max(1, Math.floor(value)))
}

function normalizeRemaining(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createError({ statusCode: 400, statusMessage: 'remainingToFreeDeliveryRub must be >= 0' })
  }
  return Math.floor(value)
}

function asFulfillmentType(value: unknown): FulfillmentType {
  if (value === 'pickup' || value === 'qr-menu' || value === 'delivery') return value
  throw createError({ statusCode: 400, statusMessage: 'fulfillmentType must be delivery | pickup | qr-menu' })
}

function scoreSource(source: RecommendationSource): number {
  if (source === 'product_link') return 100
  if (source === 'category_link') return 70
  return 40
}

function scoreProduct(input: {
  source: RecommendationSource
  sortOrder: number
  price: number
  remainingToFreeDeliveryRub: number | null
  rotationSeed: number
}): number {
  const bySource = scoreSource(input.source)
  const bySort = Math.max(0, 20 - Math.min(20, input.sortOrder))
  const remaining = input.remainingToFreeDeliveryRub
  const byFit =
    remaining && remaining > 0 && input.price > 0
      ? Math.max(0, 20 - Math.abs(remaining - input.price) / 10)
      : 0
  return bySource + bySort + byFit + input.rotationSeed
}

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<RequestBody | null>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  if (!isUuid(body.restaurantId)) {
    throw createError({ statusCode: 400, statusMessage: 'restaurantId must be a valid UUID' })
  }
  const restaurantId = body.restaurantId.trim()
  await requireRestaurantForShop(event, shopId, restaurantId)

  const fulfillmentType = asFulfillmentType(body.fulfillmentType)
  const remainingToFreeDeliveryRub = normalizeRemaining(body.remainingToFreeDeliveryRub)
  const limit = clampLimit(body.limit)
  const cartProductIdsRaw = Array.isArray(body.cartProductIds) ? body.cartProductIds : []
  const cartProductIds = Array.from(new Set(cartProductIdsRaw.filter((id) => isUuid(id)).map((id) => id.trim())))
  const cartProductIdSet = new Set(cartProductIds)

  const client = await serverSupabaseServiceRole(event)

  // Basket categories power category-level cross-sell rules.
  let cartCategoryIds: string[] = []
  if (cartProductIds.length > 0) {
    const { data: cartProducts, error: cartError } = await client
      .from('products')
      .select('id, category_id')
      .eq('shop_id', shopId)
      .in('id', cartProductIds)

    if (cartError) {
      console.error('Failed to load cart products for recommendations:', cartError)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
    }

    cartCategoryIds = Array.from(
      new Set(
        (cartProducts ?? [])
          .map((row: any) => (typeof row.category_id === 'string' ? row.category_id : null))
          .filter((id): id is string => !!id),
      ),
    )
  }

  const sourceByProductId = new Map<string, { source: RecommendationSource; sortOrder: number }>()

  if (cartProductIds.length > 0) {
    const { data: productLinks, error: productLinksError } = await client
      .from('cart_cross_sell_product_links')
      .select('target_product_id, sort_order')
      .eq('shop_id', shopId)
      .in('source_product_id', cartProductIds)
      .limit(200)

    if (productLinksError) {
      console.error('Failed to load product cross-sell links:', productLinksError)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
    }

    for (const row of productLinks ?? []) {
      const targetId = typeof row.target_product_id === 'string' ? row.target_product_id : ''
      if (!targetId || cartProductIdSet.has(targetId)) continue
      const sortOrder = Number.isFinite(row.sort_order) ? Number(row.sort_order) : 0
      const previous = sourceByProductId.get(targetId)
      if (!previous || scoreSource(previous.source) < scoreSource('product_link') || sortOrder < previous.sortOrder) {
        sourceByProductId.set(targetId, { source: 'product_link', sortOrder })
      }
    }
  }

  if (cartCategoryIds.length > 0) {
    const { data: categoryLinks, error: categoryLinksError } = await client
      .from('cart_cross_sell_category_links')
      .select('target_category_id, sort_order')
      .eq('shop_id', shopId)
      .in('source_category_id', cartCategoryIds)
      .limit(120)

    if (categoryLinksError) {
      console.error('Failed to load category cross-sell links:', categoryLinksError)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
    }

    const targetCategoryIds = Array.from(
      new Set(
        (categoryLinks ?? [])
          .map((row: any) => (typeof row.target_category_id === 'string' ? row.target_category_id : null))
          .filter((id): id is string => !!id),
      ),
    )

    if (targetCategoryIds.length > 0) {
      const { data: categoryProducts, error: categoryProductsError } = await client
        .from('products')
        .select('id, category_id')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .in('category_id', targetCategoryIds)
        .limit(300)

      if (categoryProductsError) {
        console.error('Failed to load category cross-sell products:', categoryProductsError)
        throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
      }

      const sortByCategory = new Map<string, number>()
      for (const row of categoryLinks ?? []) {
        const categoryId = typeof row.target_category_id === 'string' ? row.target_category_id : ''
        if (!categoryId) continue
        const nextSort = Number.isFinite(row.sort_order) ? Number(row.sort_order) : 0
        const current = sortByCategory.get(categoryId)
        if (current === undefined || nextSort < current) sortByCategory.set(categoryId, nextSort)
      }

      for (const row of categoryProducts ?? []) {
        const productId = typeof row.id === 'string' ? row.id : ''
        const categoryId = typeof row.category_id === 'string' ? row.category_id : ''
        if (!productId || !categoryId || cartProductIdSet.has(productId)) continue
        const sortOrder = sortByCategory.get(categoryId) ?? 0
        const previous = sourceByProductId.get(productId)
        if (!previous || scoreSource(previous.source) < scoreSource('category_link') || sortOrder < previous.sortOrder) {
          sourceByProductId.set(productId, { source: 'category_link', sortOrder })
        }
      }
    }
  }

  const needFallback = sourceByProductId.size < limit
  if (needFallback) {
    const { data: fallbackRows, error: fallbackError } = await client
      .from('cart_cross_sell_global_categories')
      .select('target_category_id, sort_order')
      .eq('shop_id', shopId)
      .limit(24)

    if (fallbackError) {
      console.error('Failed to load global cross-sell categories:', fallbackError)
      throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
    }

    const fallbackCategoryIds = Array.from(
      new Set(
        (fallbackRows ?? [])
          .map((row: any) => (typeof row.target_category_id === 'string' ? row.target_category_id : null))
          .filter((id): id is string => !!id),
      ),
    )

    if (fallbackCategoryIds.length > 0) {
      const { data: fallbackProducts, error: fallbackProductsError } = await client
        .from('products')
        .select('id, category_id')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .in('category_id', fallbackCategoryIds)
        .limit(300)

      if (fallbackProductsError) {
        console.error('Failed to load fallback cross-sell products:', fallbackProductsError)
        throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
      }

      const sortByCategory = new Map<string, number>()
      for (const row of fallbackRows ?? []) {
        const categoryId = typeof row.target_category_id === 'string' ? row.target_category_id : ''
        if (!categoryId) continue
        const nextSort = Number.isFinite(row.sort_order) ? Number(row.sort_order) : 0
        const current = sortByCategory.get(categoryId)
        if (current === undefined || nextSort < current) sortByCategory.set(categoryId, nextSort)
      }

      for (const row of fallbackProducts ?? []) {
        const productId = typeof row.id === 'string' ? row.id : ''
        const categoryId = typeof row.category_id === 'string' ? row.category_id : ''
        if (!productId || !categoryId || cartProductIdSet.has(productId)) continue
        if (sourceByProductId.has(productId)) continue
        sourceByProductId.set(productId, {
          source: 'global_fallback',
          sortOrder: sortByCategory.get(categoryId) ?? 0,
        })
      }
    }
  }

  const candidateIds = Array.from(sourceByProductId.keys())
  if (!candidateIds.length) {
    return {
      ok: true,
      items: [],
      meta: { limit, remainingToFreeDeliveryRub },
    }
  }

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id,name,price,image,category_id,is_active,delivery_restricted_override,availability_windows,categories(name,delivery_restricted,availability_windows)')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .in('id', candidateIds)
    .limit(400)

  if (productsError) {
    console.error('Failed to load recommendation products:', productsError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
  }

  const { data: overrides, error: overridesError } = await client
    .from('restaurant_product_overrides')
    .select('product_id,price_override,is_hidden,is_in_stop_list')
    .eq('shop_id', shopId)
    .eq('restaurant_id', restaurantId)
    .in('product_id', candidateIds)

  if (overridesError) {
    console.error('Failed to load restaurant overrides for recommendations:', overridesError)
    throw createError({ statusCode: 500, statusMessage: 'Failed to load cart recommendations' })
  }

  const productRows = products ?? []
  const productIds = productRows.map((row: any) => row.id)
  const categoryIds = Array.from(
    new Set(productRows.map((row: any) => (typeof row.category_id === 'string' ? row.category_id : null)).filter(Boolean)),
  ) as string[]

  const { data: requiredParams } = await client
    .from('product_parameter_kinds')
    .select('product_id')
    .in('product_id', productIds)
    .eq('is_required', true)

  const { data: productModifierGroups } = await client
    .from('product_modifier_groups')
    .select('product_id,group_id,is_required_override,min_select_override')
    .in('product_id', productIds)

  const { data: categoryModifierGroups } =
    categoryIds.length > 0
      ? await client
          .from('category_modifier_groups')
          .select('category_id,group_id')
          .in('category_id', categoryIds)
      : { data: null as null }

  const allModifierGroupIds = Array.from(
    new Set([
      ...((productModifierGroups ?? []).map((row: any) => row.group_id)),
      ...((categoryModifierGroups ?? []).map((row: any) => row.group_id)),
    ]),
  )

  const { data: modifierGroups } =
    allModifierGroupIds.length > 0
      ? await client
          .from('modifier_groups')
          .select('id,is_required,min_select')
          .in('id', allModifierGroupIds)
      : { data: null as null }

  const { data: productModifierGroupOverrides } =
    allModifierGroupIds.length > 0
      ? await client
          .from('product_modifier_group_overrides')
          .select('product_id,group_id,is_disabled')
          .in('product_id', productIds)
          .in('group_id', allModifierGroupIds)
      : { data: null as null }

  const requiredParamsSet = new Set((requiredParams ?? []).map((row: any) => row.product_id).filter(Boolean))
  const modifierDefaults = new Map<string, { isRequired: boolean; minSelect: number }>()
  for (const row of modifierGroups ?? []) {
    modifierDefaults.set(row.id, {
      isRequired: !!row.is_required,
      minSelect: Number.isFinite(row.min_select) ? Number(row.min_select) : 0,
    })
  }

  const disabledGroupByProduct = new Set(
    (productModifierGroupOverrides ?? [])
      .filter((row: any) => !!row.is_disabled)
      .map((row: any) => `${row.product_id}:${row.group_id}`),
  )

  const productGroupRowsByProductId = new Map<string, any[]>()
  for (const row of productModifierGroups ?? []) {
    if (!productGroupRowsByProductId.has(row.product_id)) productGroupRowsByProductId.set(row.product_id, [])
    productGroupRowsByProductId.get(row.product_id)!.push(row)
  }

  const categoryGroupIdsByCategoryId = new Map<string, string[]>()
  for (const row of categoryModifierGroups ?? []) {
    if (!categoryGroupIdsByCategoryId.has(row.category_id)) categoryGroupIdsByCategoryId.set(row.category_id, [])
    categoryGroupIdsByCategoryId.get(row.category_id)!.push(row.group_id)
  }

  const oneClickBlockedProductIds = new Set<string>(requiredParamsSet)
  for (const product of productRows) {
    const productId = product.id as string
    if (oneClickBlockedProductIds.has(productId)) continue

    const candidateGroupIds = new Set<string>()
    if (typeof product.category_id === 'string') {
      for (const groupId of categoryGroupIdsByCategoryId.get(product.category_id) ?? []) {
        candidateGroupIds.add(groupId)
      }
    }
    for (const row of productGroupRowsByProductId.get(productId) ?? []) {
      candidateGroupIds.add(row.group_id)
    }

    let blocked = false
    for (const groupId of candidateGroupIds) {
      if (disabledGroupByProduct.has(`${productId}:${groupId}`)) continue
      const defaultRule = modifierDefaults.get(groupId)
      const productRule = (productGroupRowsByProductId.get(productId) ?? []).find((row) => row.group_id === groupId)
      const isRequired = productRule?.is_required_override ?? defaultRule?.isRequired ?? false
      const minSelect = productRule?.min_select_override ?? defaultRule?.minSelect ?? 0
      if (isRequired || (typeof minSelect === 'number' && minSelect > 0)) {
        blocked = true
        break
      }
    }
    if (blocked) oneClickBlockedProductIds.add(productId)
  }

  const overridesByProductId = new Map<string, { hidden: boolean; stop: boolean; priceOverride: number | null }>()
  for (const row of overrides ?? []) {
    overridesByProductId.set(row.product_id, {
      hidden: !!row.is_hidden,
      stop: !!row.is_in_stop_list,
      priceOverride: typeof row.price_override === 'number' ? row.price_override : null,
    })
  }

  const daySeed = Math.floor(Date.now() / 86_400_000)
  const selected = productRows
    .map((item: any) => {
      const productId = item.id as string
      const sourceMeta = sourceByProductId.get(productId)
      if (!sourceMeta) return null
      if (cartProductIdSet.has(productId)) return null
      if (oneClickBlockedProductIds.has(productId)) return null

      const branchOverride = overridesByProductId.get(productId)
      if (branchOverride?.hidden || branchOverride?.stop) return null

      const price = branchOverride?.priceOverride ?? item.price
      if (!Number.isFinite(price) || price < 0) return null

      const availability = evaluateMenuAvailability({
        fulfillmentType,
        productDeliveryRestricted: item.delivery_restricted_override,
        categoryDeliveryRestricted: item.categories?.delivery_restricted,
        productTimeWindows: normalizeTimeWindows(item.availability_windows),
        categoryTimeWindows: normalizeTimeWindows(item.categories?.availability_windows),
      })
      if (!availability.isOrderable) return null

      const rotationSeed = ((daySeed + productId.length * 7) % 10) / 10
      const score = scoreProduct({
        source: sourceMeta.source,
        sortOrder: sourceMeta.sortOrder,
        price,
        remainingToFreeDeliveryRub,
        rotationSeed,
      })

      return {
        id: productId,
        name: item.name,
        price,
        image: item.image || '',
        category_id: item.category_id,
        category: item.categories?.name || 'Без категории',
        score,
        reasons: [
          sourceMeta.source,
          ...(remainingToFreeDeliveryRub && remainingToFreeDeliveryRub > 0 && price <= remainingToFreeDeliveryRub
            ? ['fits_remaining']
            : []),
        ],
      }
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return {
    ok: true,
    items: selected,
    meta: { limit, remainingToFreeDeliveryRub },
  }
})
