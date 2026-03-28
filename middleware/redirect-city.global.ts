function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null
  return host.trim().toLowerCase().replace(/:\d+$/, '') || null
}

function isPlatformHost(host: string | null, platformBaseDomain: string | undefined): boolean {
  if (!host) return false
  const base = platformBaseDomain ? normalizeHost(platformBaseDomain) : null
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (!base) return true // если base не настроен — не ограничиваем редирект
  return host === base || host.endsWith(`.${base}`)
}

export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  const slug = config.public?.defaultCitySlug as string | undefined
  if (!slug) return

  // Редиректим только с абсолютного корня витрины.
  if (to.path !== '/' && to.path !== '') return

  // Не редиректим на кастомных доменах ресторанов: их root уже rewrites через server middleware.
  if (process.client) {
    const host = normalizeHost(window.location.host)
    const appBaseHost = typeof config.appUrl === 'string'
      ? (() => {
          try {
            return normalizeHost(new URL(config.appUrl).host)
          } catch {
            return null
          }
        })()
      : null
    const base = config.public?.platformBaseDomain ? (config.public?.platformBaseDomain as string | undefined) : appBaseHost ?? undefined
    if (!isPlatformHost(host, base)) return
    return navigateTo(`/${slug}`)
  }

  const headers = useRequestHeaders(['host'])
  const host = normalizeHost(headers.host as string | undefined)
  const appBaseHost = typeof config.appUrl === 'string'
    ? (() => {
        try {
          return normalizeHost(new URL(config.appUrl).host)
        } catch {
          return null
        }
      })()
    : null
  const base = config.public?.platformBaseDomain ? (config.public?.platformBaseDomain as string | undefined) : appBaseHost ?? undefined
  if (!isPlatformHost(host, base)) return

  return navigateTo(`/${slug}`)
})

