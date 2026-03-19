import { createError, defineEventHandler } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireTenantShop } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const { shopId } = await requireTenantShop(event)

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('products')
    .select('id,name,price,image,description,category')
    .eq('shop_id', shopId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load products by shop:', error)
    throw createError({ statusCode: 500, message: 'Failed to load products' })
  }

  return {
    ok: true,
    shopId,
    items: data ?? [],
  }
})
