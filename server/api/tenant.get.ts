import { defineEventHandler } from 'h3'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const tenantFromContext = event.context.tenant
  if (tenantFromContext) {
    return {
      ok: true,
      shopId: tenantFromContext.shopId,
      tenantSlug: tenantFromContext.shop.slug,
      isCustomDomain: !!tenantFromContext.isCustomDomain,
      shop: {
        id: tenantFromContext.shop.id,
        slug: tenantFromContext.shop.slug,
        name: tenantFromContext.shop.name,
      },
      uiSettings: tenantFromContext.uiSettings,
    }
  }

  const { shopId, shop } = await requireTenantShop(event)

  return {
    ok: true,
    shopId: shop.id,
    tenantSlug: shop.slug,
    isCustomDomain: false,
    shop: {
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
    },
    uiSettings: shop.ui_settings ?? {},
  }
})
