import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'
import { getOrganizationSettings } from '~/server/utils/organizationStyle'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  // Учитываем настройки организации ops.fulfillmentTypes, чтобы
  // "qr-menu only" скрывал delivery/pickup на публичной витрине.
  const org = await getOrganizationSettings(event, shopId)
  const allowedSet = new Set(org.ops.fulfillmentTypes)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('restaurants')
    .select('id,name,address,supports_delivery,supports_pickup,supports_qr_menu,is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load restaurants by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load restaurants' })
  }

  return {
    ok: true,
    shopId,
    items: (data ?? []).map((item: any) => ({
      ...item,
      supports_delivery: Boolean(item.supports_delivery) && allowedSet.has('delivery'),
      supports_pickup: Boolean(item.supports_pickup) && allowedSet.has('pickup'),
      // Для QR-меню считаем доступность управляемой настройками ops.fulfillmentTypes.
      // Поэтому не пересекаем с колонкой supports_qr_menu (иначе "только qr-menu"
      // на уровне организации не включит режим в checkout).
      supports_qr_menu: allowedSet.has('qr-menu'),
    })),
  }
})
