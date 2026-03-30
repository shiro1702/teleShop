/**
 * Parameter kinds / options / overrides per product (schema after migration 016).
 * Shared by storefront catalog and order validation.
 */

export interface CatalogProductRef {
  id: string
  category_id: string | null
}

export interface CatalogParameterOption {
  id: string
  name: string
  price: number
  weightG?: number | null
  volumeMl?: number | null
  pieces?: number | null
  isDefault: boolean
  sortOrder: number
}

export interface CatalogParameterGroup {
  /** Same as parameter_kind_id — used as productParameterId in cart / order payloads */
  id: string
  parameterKindId: string
  name: string
  isRequired: boolean
  options: CatalogParameterOption[]
}

/**
 * Build parameter groups for each product (same rules as public catalog: priced override, active, not disabled).
 */
export async function fetchProductParameterGroupsByProductId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  shopId: string,
  products: CatalogProductRef[],
): Promise<Record<string, CatalogParameterGroup[]>> {
  const parametersMap: Record<string, CatalogParameterGroup[]> = {}
  const productIds = products.map((p) => p.id)
  if (productIds.length === 0) return parametersMap

  const categoryIds = [...new Set(products.map((p) => p.category_id).filter(Boolean))] as string[]

  const { data: parameterKinds } = await client
    .from('parameter_kinds')
    .select(
      `
        id, name, code, sort_order,
        parameter_options(id, name, weight_g, volume_ml, pieces, is_active, sort_order)
      `,
    )
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: true })

  const { data: productParameterKinds } = await client
    .from('product_parameter_kinds')
    .select('product_id, parameter_kind_id, is_required')
    .in('product_id', productIds)

  const { data: categoryParameterKinds } =
    categoryIds.length > 0
      ? await client
          .from('category_parameter_kinds')
          .select('category_id, parameter_kind_id, is_required')
          .in('category_id', categoryIds)
      : { data: null as null }

  const { data: parameterOverrides } = await client
    .from('product_parameter_option_overrides')
    .select('product_id, option_id, price, is_disabled, is_default')
    .in('product_id', productIds)

  if (!parameterKinds) return parametersMap

  const kindsMap = new Map(parameterKinds.map((k: any) => [k.id, k]))

  const overridesByProduct = new Map<string, Map<string, any>>()
  if (parameterOverrides) {
    parameterOverrides.forEach((ov: any) => {
      if (!overridesByProduct.has(ov.product_id)) {
        overridesByProduct.set(ov.product_id, new Map())
      }
      overridesByProduct.get(ov.product_id)!.set(ov.option_id, ov)
    })
  }

  const buildProductParameters = (productId: string, categoryId: string | null) => {
    const productKinds = new Map<string, { isRequired: boolean }>()

    if (categoryId && categoryParameterKinds) {
      categoryParameterKinds
        .filter((cpk: any) => cpk.category_id === categoryId)
        .forEach((cpk: any) => productKinds.set(cpk.parameter_kind_id, { isRequired: cpk.is_required }))
    }

    if (productParameterKinds) {
      productParameterKinds
        .filter((ppk: any) => ppk.product_id === productId)
        .forEach((ppk: any) => productKinds.set(ppk.parameter_kind_id, { isRequired: ppk.is_required }))
    }

    const productParams: CatalogParameterGroup[] = []
    const productOverridesMap = overridesByProduct.get(productId)

    for (const [kindId, config] of productKinds.entries()) {
      const kind = kindsMap.get(kindId) as any
      if (!kind?.parameter_options) continue

      const options = kind.parameter_options
        .map((opt: any) => {
          const override = productOverridesMap?.get(opt.id)
          const price = override?.price
          const isDisabled = override?.is_disabled || !opt.is_active

          if (price === undefined || price === null || isDisabled) {
            return null
          }

          return {
            id: opt.id,
            name: opt.name,
            price,
            weightG: opt.weight_g,
            volumeMl: opt.volume_ml,
            pieces: opt.pieces,
            isDefault: override?.is_default || false,
            sortOrder: opt.sort_order,
          } as CatalogParameterOption
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder) as CatalogParameterOption[]

      if (options.length > 0) {
        productParams.push({
          id: kind.id,
          parameterKindId: kind.id,
          name: kind.name,
          isRequired: config.isRequired,
          options,
        })
      }
    }

    return productParams
  }

  for (const product of products) {
    const params = buildProductParameters(product.id, product.category_id)
    if (params.length > 0) {
      parametersMap[product.id] = params
    }
  }

  return parametersMap
}

/** Shape expected by legacy order validation (nested product_parameter_options, snake_case fields). */
export function catalogGroupsToOrderValidationShape(groups: CatalogParameterGroup[]) {
  return groups.map((g) => ({
    id: g.id,
    is_required: g.isRequired,
    product_parameter_options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      weight_g: o.weightG ?? null,
      volume_ml: o.volumeMl ?? null,
      pieces: o.pieces ?? null,
      is_active: true,
    })),
  }))
}
