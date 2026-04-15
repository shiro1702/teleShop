import { createError, defineEventHandler, readBody } from 'h3'
import { requireTenantShop } from '~/server/utils/tenant'
import { resolveDeliveryForPoint } from '~/server/utils/resolveDeliveryForPoint'
import type { DeliveryZoneProperties } from '~/utils/deliveryZones'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)
  const body = await readBody<{ lat?: unknown; lon?: unknown }>(event)

  const latRaw = body?.lat
  const lonRaw = body?.lon
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw)
  const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw createError({ statusCode: 400, statusMessage: 'lat and lon are required' })
  }

  const result = await resolveDeliveryForPoint(event, shopId, lat, lon)

  const zoneProps = (row: NonNullable<typeof result.selected>): DeliveryZoneProperties => ({
    slug: row.zoneId,
    name: row.zoneName,
    minOrderAmount: row.minOrderAmount,
    deliveryCost: row.deliveryCost,
    freeDeliveryThreshold: row.freeDeliveryThreshold,
    priority: row.priority,
  })

  let infoMessage: string | null = null
  if (result.reason === 'ok' && result.selected && result.switchedDueToClosed && result.cheapestMatch) {
    infoMessage =
      `Ближайший по тарифу филиал сейчас закрыт. Заказ пойдёт в «${result.selected.restaurantName}».`
  }

  return {
    ok: true as const,
    shopId,
    reason: result.reason,
    selected:
      result.selected
        ? {
            restaurantId: result.selected.restaurantId,
            restaurantName: result.selected.restaurantName,
            zone: zoneProps(result.selected),
          }
        : null,
    switchedDueToClosed: result.switchedDueToClosed,
    cheapestClosed:
      result.switchedDueToClosed && result.cheapestMatch
        ? {
            restaurantId: result.cheapestMatch.restaurantId,
            restaurantName: result.cheapestMatch.restaurantName,
          }
        : null,
    infoMessage,
    matchCount: result.matchCount,
  }
})
