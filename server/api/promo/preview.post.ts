import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import type { CartItemPayload } from '~/server/utils/orderLinePricing'
import { loadTenantProductsForOrder, sumCartLines } from '~/server/utils/orderLinePricing'
import {
  applyPromoToCart,
  capBonusSpend,
  fetchShopLoyaltySettings,
  getCustomerBalance,
} from '~/server/utils/pricingPromoBonus'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<{
    items: CartItemPayload[]
    promoCode?: string | null
    bonusPointsToSpend?: number | null
  } | null>(event)

  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected { items }' })
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
    body.promoCode,
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

  const loyalty = await fetchShopLoyaltySettings(serviceClient, shopId)
  const balance = customerProfileId ? await getCustomerBalance(serviceClient, shopId, customerProfileId) : 0
  const requested =
    typeof body.bonusPointsToSpend === 'number' && Number.isFinite(body.bonusPointsToSpend)
      ? Math.max(0, Math.floor(body.bonusPointsToSpend))
      : 0
  const bonusSpent = capBonusSpend(loyalty, balance, subtotalAfterPromo, requested)

  const maxPct = loyalty.max_order_percent_payable_with_bonus
  const capByPct = Math.floor((subtotalAfterPromo * maxPct) / 100)
  const maxBonusForOrder = Math.min(balance, capByPct, subtotalAfterPromo)

  const payableGoods = Math.max(0, subtotalAfterPromo - bonusSpent)
  const bonusEarnBlockedBySpend = bonusSpent > 0 && !loyalty.allow_simultaneous_bonus_spend_and_earn
  const earnPercent = loyalty.bonuses_enabled && !bonusEarnBlockedBySpend
    ? Math.max(0, loyalty.earn_percent_of_subtotal)
    : 0
  const bonusEarnEstimate = Math.max(0, Math.floor((subtotalAfterPromo * earnPercent) / 100))

  return {
    ok: true,
    bonusesEnabled: loyalty.bonuses_enabled,
    allowSimultaneousBonusSpendAndEarn: loyalty.allow_simultaneous_bonus_spend_and_earn,
    bonusEarnBlockedBySpend,
    loyaltyEarnPercent: earnPercent,
    bonusEarnEstimate,
    subtotalAfterPromo,
    discountAmount: promoResult.discountAmount,
    bonusSpent,
    balance,
    maxBonusForOrder,
    payableGoods,
    promoSnapshot: promoResult.promoSnapshot,
  }
})
