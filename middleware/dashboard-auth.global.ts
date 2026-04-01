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
      if (to.path === '/dashboard') {
        const redirectFromQuery = typeof to.query.redirect === 'string' ? to.query.redirect : ''
        const redirectPath = redirectFromQuery.startsWith('/dashboard') ? redirectFromQuery : '/dashboard'
        return navigateTo({
          path: '/onboarding',
          query: { redirect: redirectPath },
        })
      }
      return navigateTo({
        path: '/dashboard',
        query: { redirect: to.fullPath },
      })
    }
  } catch {
    if (to.path === '/dashboard') {
      const redirectFromQuery = typeof to.query.redirect === 'string' ? to.query.redirect : ''
      const redirectPath = redirectFromQuery.startsWith('/dashboard') ? redirectFromQuery : '/dashboard'
      return navigateTo({
        path: '/onboarding',
        query: { redirect: redirectPath },
      })
    }
    return navigateTo({
      path: '/dashboard',
      query: { redirect: to.fullPath },
    })
  }
})
