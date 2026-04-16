import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'
import { getQuickRestoClient } from '~/server/utils/quickresto'

type Body = { restaurantId?: string }

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  if (access.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only owner can sync stop-list' })
  const body = await readBody<Body>(event).catch(() => ({} as Body))
  const db = await serverSupabaseServiceRole(event)
  const { data: shop } = await db.from('shops').select('integration_keys').eq('id', access.shopId).maybeSingle()
  const { client } = getQuickRestoClient((shop as any)?.integration_keys ?? {})

  let mappingQuery = db.from('quickresto_restaurant_mapping').select('restaurant_id,quickresto_place_id').eq('shop_id', access.shopId)
  if (body.restaurantId) mappingQuery = mappingQuery.eq('restaurant_id', body.restaurantId)
  const { data: mappings } = await mappingQuery
  if (!mappings?.length) throw createError({ statusCode: 400, statusMessage: 'No Quick Resto restaurant mappings configured' })

  const updated: Array<{ restaurantId: string; affected: number }> = []
  for (const map of mappings) {
    const stopList = await client.fetchStopList((map as any).quickresto_place_id)
    let affected = 0
    for (const s of stopList) {
      const { data: product } = await db.from('products').select('id').eq('shop_id', access.shopId).eq('external_id', s.externalProductId).maybeSingle()
      if (!product?.id) continue
      await db.from('restaurant_product_overrides').upsert({
        shop_id: access.shopId,
        restaurant_id: (map as any).restaurant_id,
        product_id: product.id,
        is_in_stop_list: s.inStopList,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'restaurant_id,product_id' })
      affected += 1
    }
    updated.push({ restaurantId: (map as any).restaurant_id, affected })
  }
  return { ok: true, updated }
})
