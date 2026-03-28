import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

type CreateShopBody = {
  shopName?: string
  slug?: string
  shopDescription?: string
  restaurantName?: string
  address?: string
  supportsDelivery?: boolean
  supportsPickup?: boolean
  telegramBotToken?: string
}

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const rawUser = supabaseUser as any
  const userId = typeof rawUser.id === 'string'
    ? rawUser.id
    : typeof rawUser.sub === 'string'
      ? rawUser.sub
      : null
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<CreateShopBody>(event)
  const shopName = body?.shopName?.trim()
  const slug = body?.slug?.trim().toLowerCase()
  const restaurantName = body?.restaurantName?.trim()
  const address = body?.address?.trim()
  if (!shopName || !slug || !restaurantName || !address) {
    throw createError({ statusCode: 400, statusMessage: 'shopName, slug, restaurantName and address are required' })
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug format' })
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

  const effectiveBotToken = body?.telegramBotToken?.trim() || 'platform-bot'
  const { data: shopData, error: shopError } = await client
    .from('shops')
    .insert({
      name: shopName,
      slug,
      telegram_bot_token: effectiveBotToken,
      ui_settings: body?.shopDescription
        ? { description: body.shopDescription.trim() }
        : {},
    })
    .select('id,slug')
    .single()

  if (shopError || !shopData?.id) {
    throw createError({ statusCode: 400, statusMessage: shopError?.message || 'Failed to create shop' })
  }

  const { error: restaurantError } = await client
    .from('restaurants')
    .insert({
      shop_id: shopData.id,
      name: restaurantName,
      address,
      supports_delivery: body?.supportsDelivery !== false,
      supports_pickup: body?.supportsPickup !== false,
      city_id: cityData.id,
    })
  if (restaurantError) {
    throw createError({ statusCode: 400, statusMessage: restaurantError.message || 'Failed to create first branch' })
  }

  const { data: profileUpdateRows, error: profileUpdateError } = await client
    .from('profiles')
    .update({ shop_id: shopData.id })
    .eq('id', userId)
    .select('id')

  // update может пройти без ошибки, но не затронуть ни одной строки (если profile ещё нет)
  if (profileUpdateError || !Array.isArray(profileUpdateRows) || profileUpdateRows.length === 0) {
    const fallbackInsert = await client
      .from('profiles')
      .upsert({ id: userId, shop_id: shopData.id }, { onConflict: 'id' })
    if (fallbackInsert.error) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to attach profile to shop' })
    }
  }

  return {
    ok: true,
    shopId: shopData.id as string,
    shopSlug: shopData.slug as string,
  }
})
