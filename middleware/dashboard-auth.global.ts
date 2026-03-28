export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/dashboard')) return

  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  const metadataShopId = typeof (session.user as any)?.user_metadata?.active_shop_id === 'string'
    ? ((session.user as any).user_metadata.active_shop_id as string).trim()
    : ''
  if (metadataShopId) {
    // Быстрый локальный допуск: shop уже известен из JWT metadata.
    // API-check всё равно остаётся ниже как основной источник прав.
    return
  }

  try {
    const access = await $fetch<{ ok: boolean; shopId?: string }>('/api/dashboard/access')
    if (!access?.ok || !access.shopId) {
      return navigateTo({
        path: '/onboarding',
        query: { redirect: to.fullPath },
      })
    }
  } catch {
    return navigateTo({
      path: '/onboarding',
      query: { redirect: to.fullPath },
    })
  }
})
