import type { SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import {
  catalogGroupsToOrderValidationShape,
  fetchProductParameterGroupsByProductId,
} from '~/server/utils/productParametersCatalog'

export interface SelectedModifierPayload {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  pricingType?: 'delta' | 'multiplier'
  priceDelta: number
  priceMultiplier?: number | null
}

export interface SelectedParameterPayload {
  parameterKindId: string
  productParameterId: string
  optionId: string
  optionName: string
  price: number
  weightG?: number | null
  volumeMl?: number | null
  pieces?: number | null
}

export interface CartItemPayload {
  id: string
  cartItemId?: string
  name: string
  price: number
  quantity: number
  selectedModifiers?: SelectedModifierPayload[]
  selectedParameters?: SelectedParameterPayload[]
}

export interface ProductRow {
  id: string
  name: string
  price: number
  parameters: any[]
}

export async function loadTenantProductsForOrder(
  serviceClient: SupabaseClient,
  shopId: string,
  productIds: string[],
): Promise<Map<string, ProductRow>> {
  const { data, error } = await serviceClient
    .from('products')
    .select('id,name,price,category_id')
    .eq('shop_id', shopId)
    .in('id', productIds)

  if (error) {
    console.error('Error querying products for order:', error)
    throw createError({ statusCode: 500, message: 'Failed to load products for this shop' })
  }

  const rows = (Array.isArray(data) ? data : []) as any[]
  const paramByProduct = await fetchProductParameterGroupsByProductId(serviceClient, shopId, rows)

  const map = new Map<string, ProductRow>()
  for (const row of rows) {
    const groups = paramByProduct[row.id]
    map.set(row.id, {
      id: row.id,
      name: row.name,
      price: row.price,
      parameters: groups ? catalogGroupsToOrderValidationShape(groups) : [],
    })
  }
  return map
}

export function priceCartItemsFromCatalog(
  bodyItems: CartItemPayload[],
  productMap: Map<string, ProductRow>,
): CartItemPayload[] {
  return bodyItems.map((item) => {
    const product = productMap.get(item.id)
    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Product ${item.id} not found in current shop`,
      })
    }
    const quantity = item.quantity > 0 ? item.quantity : 0

    let basePrice = product.price
    if (item.selectedParameters && item.selectedParameters.length > 0) {
      const param = item.selectedParameters[0]
      const dbParamGroup = product.parameters?.find((p: any) => p.id === param.productParameterId)
      if (dbParamGroup) {
        const dbOption = dbParamGroup.product_parameter_options?.find(
          (o: any) => o.id === param.optionId && o.is_active,
        )
        if (dbOption) {
          basePrice = dbOption.price
        } else {
          throw createError({
            statusCode: 400,
            message: `Invalid parameter option ${param.optionId} for product ${item.id}`,
          })
        }
      }
    } else if (product.parameters && product.parameters.some((p: any) => p.is_required)) {
      throw createError({
        statusCode: 400,
        message: `Product ${item.id} requires parameter selection`,
      })
    }

    let multiplier = 1
    let delta = 0
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      for (const mod of item.selectedModifiers) {
        if (mod.pricingType === 'multiplier') {
          multiplier *= mod.priceMultiplier ?? 1
        } else {
          delta += mod.priceDelta || 0
        }
      }
    }
    const unitPrice = Math.round(basePrice * multiplier + delta)

    return {
      id: product.id,
      cartItemId: item.cartItemId,
      name: product.name,
      price: unitPrice,
      quantity,
      selectedModifiers: item.selectedModifiers,
      selectedParameters: item.selectedParameters,
    }
  })
}

export function sumCartLines(items: CartItemPayload[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
