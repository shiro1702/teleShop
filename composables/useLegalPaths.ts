import { computed } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Базовый путь города для legal-страниц: из `city_slug` маршрута или `public.defaultCitySlug`.
 */
export function useLegalPaths() {
  const route = useRoute()
  const config = useRuntimeConfig()

  const defaultCitySlug = computed(() => {
    const raw = config.public?.defaultCitySlug
    return typeof raw === 'string' && raw.trim() ? raw.trim() : 'ulan-ude'
  })

  const cityBasePath = computed(() => {
    const cs = route.params.city_slug
    const city = Array.isArray(cs) ? cs[0] : cs
    if (typeof city === 'string' && city.trim()) return `/${city.trim()}`
    return `/${defaultCitySlug.value}`
  })

  const consentPath = computed(() => `${cityBasePath.value}/legal/consent`)
  const privacyPath = computed(() => `${cityBasePath.value}/legal/privacy`)
  const cookiesPath = computed(() => `${cityBasePath.value}/legal/cookies`)

  return { cityBasePath, consentPath, privacyPath, cookiesPath, defaultCitySlug }
}
