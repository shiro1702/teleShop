<template>
  <header
    class="fixed inset-x-0 top-0 z-50 border-b backdrop-blur"
    :style="headerStyle"
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <NuxtLink :to="homeLink" class="flex min-w-0 items-center gap-3" :style="{ color: mainTextColor }">
        <img
          :src="tenantLogoUrl"
          :alt="tenantName"
          class="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <div class="min-w-0">
          <span class="block truncate text-sm font-semibold tracking-wide sm:text-base">
            {{ tenantName }}
          </span>
          <span
            v-if="tenantDescription"
            class="hidden truncate text-xs md:block"
            :style="{ color: mutedTextColor }"
          >
            {{ tenantDescription }}
          </span>
        </div>
      </NuxtLink>

      <div v-if="showCitySelector" class="hidden md:block">
        <label class="sr-only" for="city-selector">Город</label>
        <select
          id="city-selector"
          v-model="selectedCitySlug"
          class="rounded-lg px-3 py-2 text-sm"
          :style="selectStyle"
          @change="onCityChange"
        >
          <option v-for="city in availableCities" :key="city.slug" :value="city.slug">
            {{ city.name }}
          </option>
        </select>
      </div>

      <div
        v-if="!isTelegram"
        class="flex items-center gap-2 sm:gap-3" 
      >
        <NuxtLink
          to="/partners"
          class="hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:inline-flex"
          :style="ghostButtonStyle"
        >
          Партнёрам
        </NuxtLink>

        <!-- Авторизован: на мобилке — иконка, на десктопе — текстовая кнопка -->
        <div
          v-if="user"
          ref="userMenuRootRef"
          class="relative z-[51]"
        >
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full sm:hidden"
            :style="iconButtonStyle"
            aria-label="Профиль"
            :aria-expanded="showUserMenu"
            @click="toggleUserMenu"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 14a4 4 0 10-8 0m8 0v1a3 3 0 01-3 3H11a3 3 0 01-3-3v-1m8 0a4 4 0 01-8 0m8 0a4 4 0 00-8 0M12 11a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
          </button>

          <button
            type="button"
            class="hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:flex"
            :style="ghostButtonStyle"
            :aria-expanded="showUserMenu"
            @click="toggleUserMenu"
          >
            <span class="hidden md:inline">Вошли через Telegram</span>
            <span class="md:hidden">Профиль</span>
            <svg class="h-3 w-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 rounded-lg py-1 text-sm shadow-lg"
            :style="menuStyle"
          >
            <NuxtLink
              :to="ordersLink"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showUserMenu = false"
            >
              История заказов
            </NuxtLink>
            <NuxtLink
              to="/profile"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showUserMenu = false"
            >
              Профиль
            </NuxtLink>
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              @click="logout"
            >
              Выйти
            </button>
          </div>
        </div>

        <!-- Не авторизован: на мобилке — компактно, на десктопе — текст -->
        <button
          v-else-if="telegramBotUrl"
          type="button"
          class="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100 sm:rounded-lg"
          @click="openTelegramAuth"
        >
          <span class="sm:hidden">Войти</span>
          <span class="hidden sm:inline">Войти через Telegram</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTenant } from '../composables/useTenant'
import { useTelegram } from '../composables/useTelegram'

// Nuxt auto-imports may not be recognized by Vetur in this repo.
// Keep editor types loose to avoid false-positive lints.
declare const useSupabaseClient: any
declare const useSupabaseUser: any
declare const useRuntimeConfig: any

const { isTelegram } = useTelegram()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { tenant, tenantKey, tenantPath } = useTenant()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)
const homeLink = computed(() => tenantPath('/'))
const ordersLink = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  if (citySlug && tenantSlug) return `/${citySlug}/${tenantSlug}/orders`
  if (citySlug) return `/${citySlug}/orders`
  return tenantPath('/orders')
})
const tenantName = computed(() => tenant.value.shopName || 'teleShop')
const tenantLogoUrl = computed(() => tenant.value.logoUrl || '/logo.webp')
const tenantDescription = computed(() => tenant.value.description || '')
const defaultCitySlug = computed(() =>
  (typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim())
    ? config.public.defaultCitySlug.trim()
    : 'ulan-ude')
const availableCities = ref<Array<{ id: string; name: string; slug: string }>>([])
const selectedCitySlug = ref(defaultCitySlug.value)
const isDashboardRoute = computed(() => {
  const routePath = typeof route.path === 'string' ? route.path : ''
  if (routePath.startsWith('/dashboard')) return true
  if (typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/dashboard')
  }
  return false
})
const isNonTenantRoute = computed(() => {
  const routePath = typeof route.path === 'string' ? route.path : ''
  const nonTenantPrefixes = [
    '/dashboard',
    '/onboarding',
    '/login',
    '/register',
    '/profile',
    '/partners',
    '/platform',
    '/link-telegram',
  ]
  return nonTenantPrefixes.some((prefix) => routePath.startsWith(prefix))
})
const showCitySelector = computed(() =>
  !isNonTenantRoute.value && availableCities.value.length > 1 && !!tenant.value.tenantSlug)

const theme = computed(() => tenant.value.theme || {})
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')
const surfaceCardColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')

const headerStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: `${surfaceCardColor.value}f2`,
}))

const selectStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  backgroundColor: surfaceCardColor.value,
  color: mainTextColor.value,
}))

const ghostButtonStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  color: mainTextColor.value,
  backgroundColor: 'transparent',
}))

const iconButtonStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  color: mainTextColor.value,
  backgroundColor: 'transparent',
}))

const menuStyle = computed(() => ({
  border: `1px solid ${borderColor.value}`,
  backgroundColor: surfaceCardColor.value,
  color: mainTextColor.value,
}))

const showUserMenu = ref(false)
const userMenuRootRef = ref<HTMLElement | null>(null)

function onDocumentClickCapture(e: MouseEvent) {
  if (!showUserMenu.value) return
  const root = userMenuRootRef.value
  const target = e.target as Node | null
  if (!root || !target) return
  if (!root.contains(target)) {
    showUserMenu.value = false
  }
}

function openTelegramAuth() {
  if (!telegramBotUrl.value) return
  if (typeof window !== 'undefined') {
    const url = `${telegramBotUrl.value}?start=auth_link${tenantKey.value ? `_${encodeURIComponent(tenantKey.value)}` : ''}`
    window.open(url, '_blank', 'noopener')
  }
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

async function logout() {
  showUserMenu.value = false
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Supabase signOut error:', error)
    }
  } catch (e) {
    console.error('Logout error:', e)
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  document.addEventListener('click', onDocumentClickCapture, true)
  if (isNonTenantRoute.value) return
  const routeCity = typeof route.params.city_slug === 'string' ? route.params.city_slug : ''
  selectedCitySlug.value = routeCity || defaultCitySlug.value

  // `AppHeader` может вызываться без уже загруженного `tenantKey`.
  // Для `/[city_slug]/[tenant_slug]/...` берём tenant_slug напрямую.
  const routeTenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  const shopRef = routeTenantSlug || (typeof tenantKey.value === 'string' ? tenantKey.value.trim() : '')
  if (!shopRef) {
    availableCities.value = []
    return
  }

  const url = `/api/tenant/cities?shop_id=${encodeURIComponent(shopRef)}`
  fetch(url)
    .then((response) => response.json() as Promise<{ ok: boolean; items?: Array<{ id: string; name: string; slug: string }> }>)
    .then((payload) => {
      availableCities.value = Array.isArray(payload.items) ? payload.items : []
      if (availableCities.value.length > 0) {
        const hasSelected = availableCities.value.some((city) => city.slug === selectedCitySlug.value)
        if (!hasSelected) selectedCitySlug.value = availableCities.value[0].slug
      }
    })
    .catch(() => {
      availableCities.value = []
    })
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  document.removeEventListener('click', onDocumentClickCapture, true)
})

function onCityChange() {
  const tenantSlug = tenant.value.tenantSlug
  if (!tenantSlug) return
  router.push(`/${selectedCitySlug.value}/${tenantSlug}`)
}
</script>

