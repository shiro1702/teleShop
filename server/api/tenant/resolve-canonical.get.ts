import { createError, defineEventHandler } from 'h3'
import { getShopById, resolveCanonicalTenantCartPath, resolveShopIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const ref = await resolveShopIdFromEvent(event)
  if (!ref) {
    throw createError({ statusCode: 400, statusMessage: 'Missing shop_id' })
  }

  const shop = await getShopById(event, ref)
  if (!shop || !shop.is_active) {
    throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
  }

  const canonical = await resolveCanonicalTenantCartPath(event, shop)
  return {
    ok: true,
    shopId: shop.id,
    citySlug: canonical.citySlug,
    tenantSlug: canonical.tenantSlug,
    cartPath: canonical.cartPath,
    checkoutPath: canonical.checkoutPath,
  }
})
