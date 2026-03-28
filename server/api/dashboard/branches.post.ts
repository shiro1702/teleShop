import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireDashboardAccess } from '~/server/utils/dashboard'

type CreateBranchBody = {
  name?: string
  address?: string
  supportsDelivery?: boolean
  supportsPickup?: boolean
}

export default defineEventHandler(async (event) => {
  const access = await requireDashboardAccess(event)
  const body = await readBody<CreateBranchBody>(event)
  const name = body?.name?.trim()
  const address = body?.address?.trim()
  if (!name || !address) {
    throw createError({ statusCode: 400, statusMessage: 'name and address are required' })
  }

  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)
  const citySlug = typeof config.public?.defaultCitySlug === 'string' ? config.public.defaultCitySlug : 'ulan-ude'
  const { data: cityData, error: cityError } = await client
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .maybeSingle()
  if (cityError || !cityData?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Default city is missing' })
  }

  const { data, error } = await client
    .from('restaurants')
    .insert({
      shop_id: access.shopId,
      city_id: cityData.id,
      name,
      address,
      supports_delivery: body?.supportsDelivery !== false,
      supports_pickup: body?.supportsPickup !== false,
      is_active: true,
    })
    .select('id,name,address,supports_delivery,supports_pickup,is_active')
    .single()

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Failed to create branch' })
  }

  return { ok: true, item: data }
})
