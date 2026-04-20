import type { SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import {
  type CartItemPayload,
  loadTenantProductsForOrder,
  priceCartItemsFromCatalog,
  sumCartLines,
} from '~/server/utils/orderLinePricing'

export type ShopPromoRow = {
  id: string
  shop_id: string
  code: string
  type: 'percent' | 'fixed' | 'free_item'
  value: number
  min_order_amount: number
  starts_at: string | null
  ends_at: string | null
  max_uses_total: number | null
  max_uses_per_user: number | null
  is_active: boolean
  free_item_product_id: string | null
  free_item_parameter_option_id: string | null
}

export type ShopLoyaltySettingsRow = {
  shop_id: string
  bonuses_enabled: boolean
  allow_simultaneous_bonus_spend_and_earn: boolean
  earn_percent_of_subtotal: number
  max_order_percent_payable_with_bonus: number
  expiry_enabled: boolean
  expiry_days_inactivity: number | null
  welcome_bonus_amount: number
  birthday_bonus_amount: number
  review_bonus_amount: number
  birthday_bonus_days_before: number
}

export function normalizePromoCode(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, '').toUpperCase()
}

export async function fetchShopLoyaltySettings(
  client: SupabaseClient,
  shopId: string,
): Promise<ShopLoyaltySettingsRow> {
  const { data, error } = await client
    .from('shop_loyalty_settings')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('fetchShopLoyaltySettings', error)
    throw createError({ statusCode: 500, message: 'Failed to load loyalty settings' })
  }

  if (!data) {
    return {
      shop_id: shopId,
      bonuses_enabled: true,
      allow_simultaneous_bonus_spend_and_earn: false,
      earn_percent_of_subtotal: 5,
      max_order_percent_payable_with_bonus: 25,
      expiry_enabled: false,
      expiry_days_inactivity: null,
      welcome_bonus_amount: 0,
      birthday_bonus_amount: 0,
      review_bonus_amount: 0,
      birthday_bonus_days_before: 7,
    }
  }
  return data as ShopLoyaltySettingsRow
}

export async function fetchPromoByCode(
  client: SupabaseClient,
  shopId: string,
  code: string,
): Promise<ShopPromoRow | null> {
  const normalized = normalizePromoCode(code)
  if (!normalized) return null

  const { data, error } = await client
    .from('shop_promo_codes')
    .select('*')
    .eq('shop_id', shopId)
    .eq('code', normalized)
    .maybeSingle()

  if (error) {
    console.error('fetchPromoByCode', error)
    throw createError({ statusCode: 500, message: 'Failed to load promo code' })
  }
  return data as ShopPromoRow | null
}

async function countPromoUsesTotal(client: SupabaseClient, promoId: string): Promise<number> {
  const { count, error } = await client
    .from('promo_code_uses')
    .select('*', { count: 'exact', head: true })
    .eq('promo_code_id', promoId)

  if (error) {
    console.error('countPromoUsesTotal', error)
    throw createError({ statusCode: 500, message: 'Failed to count promo uses' })
  }
  return count ?? 0
}

async function countPromoUsesForUser(
  client: SupabaseClient,
  promoId: string,
  customerProfileId: string,
): Promise<number> {
  const { count, error } = await client
    .from('promo_code_uses')
    .select('*', { count: 'exact', head: true })
    .eq('promo_code_id', promoId)
    .eq('customer_profile_id', customerProfileId)

  if (error) {
    console.error('countPromoUsesForUser', error)
    throw createError({ statusCode: 500, message: 'Failed to count promo uses' })
  }
  return count ?? 0
}

export type PromoApplyResult = {
  ok: boolean
  errorMessage?: string
  discountAmount: number
  /** Lines after catalog pricing + optional free gift line */
  pricedLines: CartItemPayload[]
  promoRow: ShopPromoRow | null
  promoSnapshot: Record<string, unknown>
}

function nowInRange(startsAt: string | null, endsAt: string | null, now: Date): boolean {
  if (startsAt) {
    const s = new Date(startsAt)
    if (now < s) return false
  }
  if (endsAt) {
    const e = new Date(endsAt)
    if (now > e) return false
  }
  return true
}

async function buildFreeGiftLine(
  serviceClient: SupabaseClient,
  shopId: string,
  promo: ShopPromoRow,
): Promise<{ line: CartItemPayload; nominalUnitPrice: number }> {
  const pid = promo.free_item_product_id
  if (!pid) {
    throw createError({ statusCode: 400, message: 'Промокод подарка настроен неверно' })
  }

  let selectedParameters: CartItemPayload['selectedParameters'] = []
  if (promo.free_item_parameter_option_id) {
    const { data: optRow, error: optErr } = await serviceClient
      .from('parameter_options')
      .select('id, parameter_kind_id, name, weight_g, volume_ml, pieces, is_active')
      .eq('id', promo.free_item_parameter_option_id)
      .maybeSingle<{
        id: string
        parameter_kind_id: string
        name: string
        weight_g: number | null
        volume_ml: number | null
        pieces: number | null
        is_active: boolean
      }>()
    if (optErr || !optRow || !optRow.is_active) {
      throw createError({ statusCode: 400, message: 'Вариант подарка по промокоду не найден' })
    }
    const { data: ovRow, error: ovErr } = await serviceClient
      .from('product_parameter_option_overrides')
      .select('price, is_disabled')
      .eq('product_id', pid)
      .eq('option_id', promo.free_item_parameter_option_id)
      .maybeSingle<{ price: number | null; is_disabled: boolean }>()
    if (ovErr || !ovRow || ovRow.is_disabled || ovRow.price === null || ovRow.price === undefined) {
      throw createError({
        statusCode: 400,
        message: 'Вариант подарка по промокоду недоступен для этого товара',
      })
    }
    const kindId = optRow.parameter_kind_id
    selectedParameters = [
      {
        parameterKindId: kindId,
        productParameterId: kindId,
        optionId: optRow.id,
        optionName: optRow.name,
        price: ovRow.price,
        weightG: optRow.weight_g,
        volumeMl: optRow.volume_ml,
        pieces: optRow.pieces,
      },
    ]
  }

  const map = await loadTenantProductsForOrder(serviceClient, shopId, [pid])
  const priced = priceCartItemsFromCatalog(
    [
      {
        id: pid,
        name: '',
        price: 0,
        quantity: 1,
        cartItemId: `promo-free-${promo.id}`,
        selectedModifiers: [],
        selectedParameters,
      },
    ],
    map,
  )

  if (priced.length !== 1) {
    throw createError({ statusCode: 400, message: 'Не удалось добавить подарок по промокоду' })
  }

  const p0 = priced[0]
  const nominal = p0.price
  const line: CartItemPayload = {
    ...p0,
    name: `${p0.name} (подарок)`,
    price: 0,
    quantity: 1,
    cartItemId: `promo-free-${promo.id}`,
  }

  return { line, nominalUnitPrice: nominal }
}

export async function applyPromoToCart(
  serviceClient: SupabaseClient,
  shopId: string,
  bodyItems: CartItemPayload[],
  productMap: Map<string, import('~/server/utils/orderLinePricing').ProductRow>,
  promoCodeRaw: string | null | undefined,
  customerProfileId: string | null,
  now: Date = new Date(),
): Promise<PromoApplyResult> {
  const code = normalizePromoCode(promoCodeRaw)
  if (!code) {
    const priced = priceCartItemsFromCatalog(bodyItems, productMap)
    return {
      ok: true,
      discountAmount: 0,
      pricedLines: priced,
      promoRow: null,
      promoSnapshot: { subtotalAfterPromo: sumCartLines(priced) },
    }
  }

  const promo = await fetchPromoByCode(serviceClient, shopId, code)
  if (!promo || !promo.is_active) {
    return {
      ok: false,
      errorMessage: 'Промокод не найден',
      discountAmount: 0,
      pricedLines: priceCartItemsFromCatalog(bodyItems, productMap),
      promoRow: null,
      promoSnapshot: {},
    }
  }

  if (!nowInRange(promo.starts_at, promo.ends_at, now)) {
    return {
      ok: false,
      errorMessage: 'Срок действия промокода истёк',
      discountAmount: 0,
      pricedLines: priceCartItemsFromCatalog(bodyItems, productMap),
      promoRow: promo,
      promoSnapshot: { code: promo.code },
    }
  }

  let pricedLines = priceCartItemsFromCatalog(bodyItems, productMap)
  const rawSubtotal = sumCartLines(pricedLines)

  if (rawSubtotal < promo.min_order_amount) {
    return {
      ok: false,
      errorMessage: `Минимальная сумма заказа для этого промокода: ${promo.min_order_amount} ₽`,
      discountAmount: 0,
      pricedLines,
      promoRow: promo,
      promoSnapshot: { code: promo.code, min_order_amount: promo.min_order_amount },
    }
  }

  const totalUses = await countPromoUsesTotal(serviceClient, promo.id)
  if (promo.max_uses_total != null && totalUses >= promo.max_uses_total) {
    return {
      ok: false,
      errorMessage: 'Лимит использований промокода исчерпан',
      discountAmount: 0,
      pricedLines,
      promoRow: promo,
      promoSnapshot: { code: promo.code },
    }
  }

  if (promo.max_uses_per_user != null) {
    if (!customerProfileId) {
      return {
        ok: false,
        errorMessage: 'Этот промокод доступен только авторизованным пользователям',
        discountAmount: 0,
        pricedLines,
        promoRow: promo,
        promoSnapshot: { code: promo.code },
      }
    }
    const userUses = await countPromoUsesForUser(serviceClient, promo.id, customerProfileId)
    if (userUses >= promo.max_uses_per_user) {
      return {
        ok: false,
        errorMessage: 'Вы уже использовали этот промокод',
        discountAmount: 0,
        pricedLines,
        promoRow: promo,
        promoSnapshot: { code: promo.code },
      }
    }
  }

  let discountAmount = 0
  if (promo.type === 'percent') {
    discountAmount = Math.min(rawSubtotal, Math.round((rawSubtotal * promo.value) / 100))
  } else if (promo.type === 'fixed') {
    discountAmount = Math.min(rawSubtotal, promo.value)
  } else if (promo.type === 'free_item') {
    const { line, nominalUnitPrice } = await buildFreeGiftLine(serviceClient, shopId, promo)
    pricedLines = [...pricedLines, line]
    discountAmount = nominalUnitPrice
  }

  const lineSum = sumCartLines(pricedLines)
  const subtotalAfterPromo =
    promo.type === 'free_item' ? lineSum : Math.max(0, lineSum - discountAmount)

  const snapshot = {
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discountAmount,
    subtotalAfterPromo,
  }

  return {
    ok: true,
    discountAmount,
    pricedLines,
    promoRow: promo,
    promoSnapshot: snapshot,
  }
}

export async function getCustomerBalance(
  client: SupabaseClient,
  shopId: string,
  profileId: string,
): Promise<number> {
  const { data, error } = await client
    .from('shop_customer_balances')
    .select('balance')
    .eq('shop_id', shopId)
    .eq('customer_profile_id', profileId)
    .maybeSingle<{ balance: number }>()
  if (error) {
    console.error('getCustomerBalance', error)
    return 0
  }
  return typeof data?.balance === 'number' ? data.balance : 0
}

export function capBonusSpend(
  settings: ShopLoyaltySettingsRow,
  balance: number,
  subtotalAfterPromo: number,
  requested: number,
): number {
  if (!settings.bonuses_enabled) return 0
  const maxPct = settings.max_order_percent_payable_with_bonus
  const capByPct = Math.floor((subtotalAfterPromo * maxPct) / 100)
  const maxApply = Math.min(balance, capByPct, subtotalAfterPromo)
  return Math.min(Math.max(0, Math.floor(requested)), Math.max(0, maxApply))
}

/** Начисление бонусов после успешной выдачи/доставки (идемпотентно по unique на earn_order). */
export async function accrueLoyaltyEarnForPaidOrder(
  client: SupabaseClient,
  orderId: string,
  shopId: string,
): Promise<void> {
  const { data: order, error: oErr } = await client
    .from('orders')
    .select('id, shop_id, subtotal, customer_profile_id, status, bonus_amount_spent')
    .eq('id', orderId)
    .eq('shop_id', shopId)
    .maybeSingle<{
      id: string
      shop_id: string
      subtotal: number
      customer_profile_id: string | null
      status: string
      bonus_amount_spent: number | null
    }>()

  if (oErr || !order?.customer_profile_id) {
    return
  }
  if (String(order.status || '').toLowerCase() !== 'handed_to_customer') {
    return
  }

  const settings = await fetchShopLoyaltySettings(client, shopId)
  if (!settings.bonuses_enabled) return
  const bonusSpent = typeof order.bonus_amount_spent === 'number' ? order.bonus_amount_spent : 0
  if (bonusSpent > 0 && !settings.allow_simultaneous_bonus_spend_and_earn) return
  const pct = settings.earn_percent_of_subtotal
  if (pct <= 0) return

  const earn = Math.floor((order.subtotal * pct) / 100)
  if (earn <= 0) return

  const { error: insErr } = await client.from('loyalty_ledger').insert({
    shop_id: shopId,
    customer_profile_id: order.customer_profile_id,
    order_id: orderId,
    delta: earn,
    reason: 'earn_order',
    meta: { subtotal: order.subtotal, percent: pct },
  })

  if (insErr?.code === '23505') {
    return
  }
  if (insErr) {
    console.error('accrueLoyaltyEarnForPaidOrder insert:', insErr)
    return
  }

  const cur = await getCustomerBalance(client, shopId, order.customer_profile_id)
  const { error: upErr } = await client.from('shop_customer_balances').upsert(
    {
      shop_id: shopId,
      customer_profile_id: order.customer_profile_id,
      balance: cur + earn,
      last_activity_at: new Date().toISOString(),
    },
    { onConflict: 'shop_id,customer_profile_id' },
  )
  if (upErr) {
    console.error('accrueLoyaltyEarnForPaidOrder balance:', upErr)
  }
}
