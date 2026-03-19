import { createError, defineEventHandler, getHeader } from 'h3'
import {
  extractBotIdFromInitData,
  getShopByBotId,
  getShopById,
  resolveShopIdFromEvent,
} from '~/server/utils/tenant'

const REQUIRED_PATHS = [
  '/api/order',
  '/api/tenant',
  '/api/products',
  '/api/restaurants',
  '/api/restaurant-zones',
  '/api/cart-bridge',
]

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  const isCartBridgeGet = path.startsWith('/api/cart-bridge') && event.method === 'GET'

  const shopId = await resolveShopIdFromEvent(event)
  const isRequired = REQUIRED_PATHS.some((prefix) => path.startsWith(prefix))

  let shop = shopId ? await getShopById(event, shopId) : null

  if (!shop) {
    const initData = getHeader(event, 'x-telegram-init-data')
    const botId = initData ? extractBotIdFromInitData(initData) : null
    if (botId) {
      shop = await getShopByBotId(event, botId)
    }
  }

  if (!shop) {
    if (isCartBridgeGet) {
      return
    }
    if (isRequired) {
      throw createError({ statusCode: 404, message: 'Shop not found' })
    }
    return
  }
  if (!shop.is_active) {
    throw createError({ statusCode: 403, message: 'Shop is inactive' })
  }

  event.context.tenant = {
    shopId: shop.id,
    shop,
    telegramBotToken: shop.telegram_bot_token,
    integrationKeys: shop.integration_keys ?? {},
    uiSettings: shop.ui_settings ?? {},
  }
})
