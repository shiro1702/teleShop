export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/dashboard')) return
  const isDashboardLoginPage = to.path === '/dashboard/login'

  const resolveRedirectPath = () => {
    const redirectFromQuery = typeof to.query.redirect === 'string' ? to.query.redirect : ''
    return redirectFromQuery.startsWith('/dashboard') ? redirectFromQuery : '/dashboard'
  }

  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    if (isDashboardLoginPage) return
    return navigateTo({
      path: '/dashboard/login',
      query: { redirect: to.fullPath },
    })
  }

  if (isDashboardLoginPage) {
    const redirectFromQuery = typeof to.query.redirect === 'string' ? to.query.redirect : ''
    const redirectTarget = redirectFromQuery.startsWith('/dashboard') ? redirectFromQuery : '/dashboard'
    return navigateTo(redirectTarget)
  }

  try {
    const access = await $fetch<{ ok: boolean; shopId?: string }>('/api/dashboard/access')
    if (!access?.ok || !access.shopId) {
      if (to.path === '/dashboard') {
        return navigateTo({
          path: '/onboarding',
          query: { redirect: resolveRedirectPath() },
        })
      }
      return navigateTo({
        path: '/dashboard',
        query: { redirect: to.fullPath },
      })
    }
  } catch (error: any) {
    const statusCode = error?.statusCode ?? error?.response?.status

    // On transient backend/network failures we should not push users into onboarding.
    // Only redirect to onboarding when backend explicitly says there is no shop access.
    if (statusCode === 403 && to.path === '/dashboard') {
      return navigateTo({
        path: '/onboarding',
        query: { redirect: resolveRedirectPath() },
      })
    }

    if (statusCode === 401) {
      return navigateTo({
        path: '/dashboard/login',
        query: { redirect: to.fullPath },
      })
    }

    return
  }
})
