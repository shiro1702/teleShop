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
          class="h-10 w-auto shrink-0 object-cover"
        />
        <div class="min-w-0">
          <span class="block truncate text-sm font-semibold tracking-wide sm:text-base">
            {{ tenantName }}
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

      <!-- Miniapp (Telegram / MAX): без «ЛК» — заказы и бонусы в выпадающем меню как у авторизованного на сайте -->
      <div
        v-if="isMessengerMiniApp && showMiniappCustomerLinks"
        ref="miniappMenuRootRef"
        class="relative z-[51] shrink-0"
      >
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
          :style="ghostButtonStyle"
          :aria-expanded="showMiniappMenu"
          aria-label="Меню заказов"
          @click="showMiniappMenu = !showMiniappMenu"
        >
          <span class="hidden sm:inline">Заказы и бонусы</span>
          <span class="sm:hidden">Меню</span>
          <svg class="h-3 w-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <Transition name="dropdown">
          <div
            v-if="showMiniappMenu"
            class="absolute right-0 mt-2 w-52 rounded-lg py-1 text-sm shadow-lg dropdown-panel"
            :style="menuStyle"
          >
            <NuxtLink
              :to="ordersLink"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showMiniappMenu = false"
            >
              История заказов
            </NuxtLink>
            <NuxtLink
              v-if="bonusesMenuVisible"
              :to="bonusesLink"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showMiniappMenu = false"
            >
              Бонусы
            </NuxtLink>
            <NuxtLink
              v-if="achievementsMenuVisible"
              :to="achievementsLink"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showMiniappMenu = false"
            >
              Ачивки
            </NuxtLink>
            <NuxtLink
              to="/profile"
              class="block px-3 py-2"
              :style="{ color: mainTextColor }"
              @click="showMiniappMenu = false"
            >
              Профиль
            </NuxtLink>
          </div>
        </Transition>
      </div>

      <div
        v-if="!isMessengerMiniApp"
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
            <span>Профиль</span>
            <svg class="h-3 w-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <Transition name="dropdown">
            <div
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-48 rounded-lg py-1 text-sm shadow-lg dropdown-panel"
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
                v-if="bonusesMenuVisible"
                :to="bonusesLink"
                class="block px-3 py-2"
                :style="{ color: mainTextColor }"
                @click="showUserMenu = false"
              >
                Бонусы
              </NuxtLink>
              <NuxtLink
                v-if="achievementsMenuVisible"
                :to="achievementsLink"
                class="block px-3 py-2"
                :style="{ color: mainTextColor }"
                @click="showUserMenu = false"
              >
                Ачивки
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
          </Transition>
        </div>

        <!-- Не авторизован: на мобилке — компактно, на десктопе — текст -->
        <button
          v-else-if="telegramBotUrl || maxBotUrl"
          type="button"
          class="rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-50 active:bg-primary-100 sm:rounded-lg"
          @click="openAuthModal"
        >
          <span class="sm:hidden">Войти</span>
          <span class="hidden sm:inline">Войти</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showAuthModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40" @click="closeAuthModal" />
          <div class="relative w-full max-w-sm rounded-2xl p-5 shadow-xl modal-panel" :style="menuStyle">
            <h3 class="text-base font-semibold" :style="{ color: mainTextColor }">Выберите способ входа</h3>
            <p class="mt-1 text-sm" :style="{ color: mutedTextColor }">Доступна авторизация через Telegram или MAX.</p>
            <div class="mt-4 space-y-2">
              <button
                v-if="telegramBotUrl"
                type="button"
                class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:bg-primary-600"
                @click="openTelegramAuth"
              >
                Войти через Telegram
              </button>
              <button
                v-if="maxBotUrl"
                type="button"
                class="w-full rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-50"
                @click="openMaxAuth"
              >
                Войти через MAX
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

const { isMessengerMiniApp } = useTelegram()
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
const maxBotUrl = computed(() => {
  const raw = (config.public.maxBotUrl as string | undefined) || ''
  const trimmed = raw.trim()
  return trimmed || null
})
const homeLink = computed(() => tenantPath('/'))
const ordersLink = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  if (citySlug && tenantSlug) return `/${citySlug}/${tenantSlug}/orders`
  if (citySlug) return `/${citySlug}/orders`
  return tenantPath('/orders')
})
const bonusesLink = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  if (citySlug && tenantSlug) return `/${citySlug}/${tenantSlug}/bonuses`
  return tenantPath('/bonuses')
})
const achievementsLink = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  if (citySlug && tenantSlug) return `/${citySlug}/${tenantSlug}/achievements`
  if (citySlug) return `/${citySlug}/achievements`
  return tenantPath('/achievements')
})
const bonusesMenuVisible = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  return !!(citySlug && tenantSlug) || !!tenant.value.tenantSlug
})
const achievementsMenuVisible = computed(() => {
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const tenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  return !!citySlug || !!tenantSlug || !!tenant.value.tenantSlug
})

/** Показываем miniapp-меню на витрине ресторана и на городской странице агрегатора. */
const showMiniappCustomerLinks = computed(() => {
  if (isNonTenantRoute.value || isDashboardRoute.value) return false
  const routeCitySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const routeTenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  return !!(routeCitySlug || routeTenantSlug || tenant.value.tenantSlug)
})
const tenantName = computed(() => tenant.value.shopName || 'PocketMenu')
const tenantLogoUrl = computed(() => tenant.value.logoUrl || tenant.value.logoLargeUrl || '/logo.webp')
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
    '/link-max',
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
const showMiniappMenu = ref(false)
const showAuthModal = ref(false)
const userMenuRootRef = ref<HTMLElement | null>(null)
const miniappMenuRootRef = ref<HTMLElement | null>(null)

function onDocumentClickCapture(e: MouseEvent) {
  const target = e.target as Node | null
  if (!target) return
  if (showUserMenu.value) {
    const root = userMenuRootRef.value
    if (root && !root.contains(target)) showUserMenu.value = false
  }
  if (showMiniappMenu.value) {
    const miniRoot = miniappMenuRootRef.value
    if (miniRoot && !miniRoot.contains(target)) showMiniappMenu.value = false
  }
}

async function openTelegramAuth() {
  showAuthModal.value = false
  if (!telegramBotUrl.value || typeof window === 'undefined') return
  const shopRef = tenantKey.value?.trim() || ''
  if (!shopRef) {
    window.alert('Откройте вход из страницы ресторана.')
    return
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-telegram-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: `${tenantPath('/checkout')}?step=1`,
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const tgUrl = `${telegramBotUrl.value}?start=${encodeURIComponent(res.botStartParam)}`
    window.open(tgUrl, '_blank', 'noopener')
    await router.push({
      path: '/link-telegram',
      query: {
        token: res.token,
        redirect: `${tenantPath('/checkout')}?step=1`,
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через Telegram. Попробуйте ещё раз.')
  }
}

async function openMaxAuth() {
  showAuthModal.value = false
  if (!maxBotUrl.value || typeof window === 'undefined') return
  const shopRef = tenantKey.value?.trim() || ''
  if (!shopRef) {
    window.alert('Откройте вход из страницы ресторана.')
    return
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-max-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: `${tenantPath('/checkout')}?step=1`,
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const hasQuery = maxBotUrl.value.includes('?')
    const maxUrl = `${maxBotUrl.value}${hasQuery ? '&' : '?'}start=${encodeURIComponent(res.botStartParam)}`
    window.open(maxUrl, '_blank', 'noopener')
    await router.push({
      path: '/link-max',
      query: {
        token: res.token,
        redirect: `${tenantPath('/checkout')}?step=1`,
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через MAX. Попробуйте ещё раз.')
  }
}

function openAuthModal() {
  showAuthModal.value = true
}

function closeAuthModal() {
  showAuthModal.value = false
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

async function logout() {
  showUserMenu.value = false
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  const routeTenantSlug = typeof route.params.tenant_slug === 'string' ? route.params.tenant_slug.trim() : ''
  const currentTenantSlug = routeTenantSlug || (typeof tenant.value.tenantSlug === 'string' ? tenant.value.tenantSlug.trim() : '')
  const fallbackCitySlug = selectedCitySlug.value || defaultCitySlug.value
  const aggregatorPath = citySlug ? `/${citySlug}` : `/${fallbackCitySlug}`
  const redirectPath = currentTenantSlug && citySlug ? `/${citySlug}/${currentTenantSlug}` : aggregatorPath

  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Supabase signOut error:', error)
    }
  } catch (e) {
    console.error('Logout error:', e)
  } finally {
    await router.push(redirectPath)
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

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>

