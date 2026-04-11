import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'
import { normalizeWeeklyWorkingHours, resolveEffectiveWorkingHours } from '~/utils/workingHours'

/**
 * Публичные флаги филиала согласованы с ops.fulfillmentTypes (после нормализации — только
 * delivery | pickup | dine-in; legacy qr-menu/showcase-order → dine-in).
 * Заказ и каталог по-прежнему используют fulfillmentType `qr-menu` для сценария «в зале»
 * (см. order.post, products.get / x-fulfillment-type); supports_qr_menu ниже — это
 * «можно оформить заказ в зале», а не отдельный канал в БД заказов.
 */
export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const org = await getOrganizationSettings(event, shopId)
  const allowedSet = new Set(org.ops.fulfillmentTypes)
  const organizationWorkingHours = org.ops.workingHours
  const organizationTimezone = org.locale.timezone

  const client = await serverSupabaseServiceRole(event)
  let data: any[] | null = null
  let error: any = null
  const primary = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,use_organization_working_hours,working_hours,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  data = primary.data as any[] | null
  error = primary.error
  if (error && error.code === '42703') {
    const fallback = await client
      .from('restaurants')
      .select('id,name,address,supports_delivery,supports_pickup,supports_dine_in,supports_qr_menu,supports_showcase_order,is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    data = (fallback.data as any[] | null)?.map((item) => ({
      ...item,
      supports_dine_in: item.supports_dine_in ?? false,
      supports_showcase_order: item.supports_showcase_order ?? false,
      use_organization_working_hours: true,
      working_hours: null,
    })) ?? []
    error = fallback.error
  }
  if (error && error.code === '42703') {
    const legacy = await client
      .from('restaurants')
      .select('id,name,address,supports_delivery,supports_pickup,supports_qr_menu,supports_showcase_order,is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    data = (legacy.data as any[] | null)?.map((item) => ({
      ...item,
      supports_dine_in: false,
      supports_showcase_order: item.supports_showcase_order ?? false,
      use_organization_working_hours: true,
      working_hours: null,
    })) ?? []
    error = legacy.error
  }

  if (error) {
    console.error('Failed to load restaurants by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants' })
  }

  const hallOrderingEnabled =
    allowedSet.has('dine-in')
    && org.ops.dineInHallMode !== 'qr-menu-browse'

  return {
    ok: true,
    shopId,
    organizationTimezone,
    organizationWorkingHours,
    dineInHallMode: org.ops.dineInHallMode,
    items: (data ?? []).map((item: any) => ({
      ...item,
      ...(() => {
        const branchWorkingHours = normalizeWeeklyWorkingHours(item.working_hours, organizationWorkingHours)
        const useOrganizationHours = item.use_organization_working_hours !== false
        return {
          use_organization_working_hours: useOrganizationHours,
          working_hours: branchWorkingHours,
          effective_working_hours: resolveEffectiveWorkingHours(organizationWorkingHours, {
            useOrganizationHours,
            workingHours: branchWorkingHours,
          }),
        }
      })(),
      supports_delivery: Boolean(item.supports_delivery) && allowedSet.has('delivery'),
      supports_pickup: Boolean(item.supports_pickup) && allowedSet.has('pickup'),
      /** Заказ «в зале» в чекауте (тип qr-menu): подрежим to-table → supports_qr_menu; pickup-point → supports_showcase_order. */
      supports_qr_menu:
        hallOrderingEnabled
        && (
          (org.ops.dineInHallMode === 'to-table' && Boolean(item.supports_qr_menu))
          || (org.ops.dineInHallMode === 'pickup-point' && Boolean(item.supports_showcase_order))
        ),
      /**
       * Показ режима «В ресторане» на витрине: достаточно org dine-in + филиал «в зале».
       * Отличается от supports_qr_menu (только реальный заказ в зале при to-table / pickup-point).
       */
      supports_in_restaurant:
        allowedSet.has('dine-in') && Boolean(item.supports_dine_in),
    })),
  }
})
