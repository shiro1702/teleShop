import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type ProductLinkInput = {
  sourceProductId?: string
  targetProductId?: string
  sortOrder?: number
}

type CategoryLinkInput = {
  sourceCategoryId?: string
  targetCategoryId?: string
  sortOrder?: number
}

type GlobalCategoryInput = {
  targetCategoryId?: string
  sortOrder?: number
}

type RequestBody = {
  productLinks?: ProductLinkInput[]
  categoryLinks?: CategoryLinkInput[]
  globalCategories?: GlobalCategoryInput[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeSortOrder(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.floor(value)
}

function ensureUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value.trim())) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be a valid UUID` })
  }
  return value.trim()
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const client = await serverSupabaseServiceRole(event)
  const body = await readBody<RequestBody | null>(event)

  const productLinksInput = Array.isArray(body?.productLinks) ? body!.productLinks : []
  const categoryLinksInput = Array.isArray(body?.categoryLinks) ? body!.categoryLinks : []
  const globalCategoriesInput = Array.isArray(body?.globalCategories) ? body!.globalCategories : []

  const productLinks = productLinksInput.map((row, index) => {
    const sourceProductId = ensureUuid(row?.sourceProductId, `productLinks[${index}].sourceProductId`)
    const targetProductId = ensureUuid(row?.targetProductId, `productLinks[${index}].targetProductId`)
    if (sourceProductId === targetProductId) {
      throw createError({ statusCode: 400, statusMessage: `productLinks[${index}] sourceProductId must differ from targetProductId` })
    }
    return {
      shop_id: access.shopId,
      source_product_id: sourceProductId,
      target_product_id: targetProductId,
      sort_order: normalizeSortOrder(row?.sortOrder),
      updated_at: new Date().toISOString(),
    }
  })

  const categoryLinks = categoryLinksInput.map((row, index) => {
    const sourceCategoryId = ensureUuid(row?.sourceCategoryId, `categoryLinks[${index}].sourceCategoryId`)
    const targetCategoryId = ensureUuid(row?.targetCategoryId, `categoryLinks[${index}].targetCategoryId`)
    if (sourceCategoryId === targetCategoryId) {
      throw createError({ statusCode: 400, statusMessage: `categoryLinks[${index}] sourceCategoryId must differ from targetCategoryId` })
    }
    return {
      shop_id: access.shopId,
      source_category_id: sourceCategoryId,
      target_category_id: targetCategoryId,
      sort_order: normalizeSortOrder(row?.sortOrder),
      updated_at: new Date().toISOString(),
    }
  })

  const globalCategories = globalCategoriesInput.map((row, index) => ({
    shop_id: access.shopId,
    target_category_id: ensureUuid(row?.targetCategoryId, `globalCategories[${index}].targetCategoryId`),
    sort_order: normalizeSortOrder(row?.sortOrder),
    updated_at: new Date().toISOString(),
  }))

  const deleteProductLinks = client
    .from('cart_cross_sell_product_links')
    .delete()
    .eq('shop_id', access.shopId)
  const deleteCategoryLinks = client
    .from('cart_cross_sell_category_links')
    .delete()
    .eq('shop_id', access.shopId)
  const deleteGlobalCategories = client
    .from('cart_cross_sell_global_categories')
    .delete()
    .eq('shop_id', access.shopId)

  const [deleteProductRes, deleteCategoryRes, deleteGlobalRes] = await Promise.all([
    deleteProductLinks,
    deleteCategoryLinks,
    deleteGlobalCategories,
  ])

  if (deleteProductRes.error || deleteCategoryRes.error || deleteGlobalRes.error) {
    console.error('Failed to clean old cross-sell rules:', {
      deleteProductError: deleteProductRes.error,
      deleteCategoryError: deleteCategoryRes.error,
      deleteGlobalError: deleteGlobalRes.error,
    })
    throw createError({ statusCode: 500, statusMessage: 'Failed to update cross-sell rules' })
  }

  if (productLinks.length > 0) {
    const { error } = await client
      .from('cart_cross_sell_product_links')
      .insert(productLinks)
    if (error) {
      console.error('Failed to insert product cross-sell links:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to update cross-sell rules' })
    }
  }

  if (categoryLinks.length > 0) {
    const { error } = await client
      .from('cart_cross_sell_category_links')
      .insert(categoryLinks)
    if (error) {
      console.error('Failed to insert category cross-sell links:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to update cross-sell rules' })
    }
  }

  if (globalCategories.length > 0) {
    const { error } = await client
      .from('cart_cross_sell_global_categories')
      .insert(globalCategories)
    if (error) {
      console.error('Failed to insert global cross-sell categories:', error)
      throw createError({ statusCode: 500, statusMessage: 'Failed to update cross-sell rules' })
    }
  }

  return {
    ok: true,
    counts: {
      productLinks: productLinks.length,
      categoryLinks: categoryLinks.length,
      globalCategories: globalCategories.length,
    },
  }
})
