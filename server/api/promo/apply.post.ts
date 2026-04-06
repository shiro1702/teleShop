import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import type { CartItemPayload } from '~/server/utils/orderLinePricing'
import { loadTenantProductsForOrder, sumCartLines } from '~/server/utils/orderLinePricing'
import { applyPromoToCart } from '~/server/utils/pricingPromoBonus'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<{
    items: CartItemPayload[]
    promoCode?: string | null
  } | null>(event)

  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected { items }' })
  }

  const promoCode = (body.promoCode || '').trim()
  if (!promoCode) {
    return {
      ok: false,
      error: 'Введите промокод',
    }
  }

  const serviceClient = await serverSupabaseServiceRole(event)

  let customerProfileId: string | null = null
  const supabaseUser = await serverSupabaseUser(event)
  if (supabaseUser) {
    const raw = supabaseUser as any
    customerProfileId =
      typeof raw.id === 'string' ? raw.id : typeof raw.sub === 'string' ? raw.sub : null
  }

  const uniqueProductIds = Array.from(new Set(body.items.map((i) => i.id)))
  const productMap = await loadTenantProductsForOrder(serviceClient, shopId, uniqueProductIds)

  const promoResult = await applyPromoToCart(
    serviceClient,
    shopId,
    body.items,
    productMap,
    promoCode,
    customerProfileId,
  )

  if (!promoResult.ok) {
    return {
      ok: false,
      error: promoResult.errorMessage || 'Промокод не применён',
    }
  }

  const snap = promoResult.promoSnapshot as { subtotalAfterPromo?: number }
  const subtotalAfterPromo =
    typeof snap.subtotalAfterPromo === 'number' ? snap.subtotalAfterPromo : sumCartLines(promoResult.pricedLines)

  return {
    ok: true,
    promoCode: promoCode.toUpperCase(),
    subtotalAfterPromo,
    discountAmount: promoResult.discountAmount,
    promoSnapshot: promoResult.promoSnapshot,
  }
})
