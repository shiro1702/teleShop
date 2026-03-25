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
