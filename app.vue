<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900" :style="rootStyle">
    <AppHeader />
    <div :class="isTelegram ? '' : 'pt-16'">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
    <footer
      v-if="isStorefrontRoute"
      class="mt-12 border-t border-gray-200 bg-white/95"
    >
      <div class="mx-auto max-w-7xl px-4 py-6 text-xs leading-6 text-gray-600 sm:px-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <template v-if="tenantLegalName || tenantInn || tenantOgrn">
              <p class="font-medium text-gray-700">
                Продавец: {{ tenantLegalName || 'Ресторан-партнер' }}
              </p>
              <p v-if="tenantInn">ИНН: {{ tenantInn }}</p>
              <p v-if="tenantOgrn">ОГРН/ОГРНИП: {{ tenantOgrn }}</p>
            </template>
            <template v-else>
              <p class="font-medium text-gray-700">
                Оператор платформы: ИП Баранзаев Арсалан Баярович
              </p>
              <p>ИНН: 032384437278</p>
              <p>ОГРНИП: 325030000033105</p>
            </template>
          </div>
          <div>
            <p class="font-medium text-gray-700">Юридические документы</p>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <NuxtLink :to="`${cityBasePath}/legal/privacy`" class="underline decoration-dotted hover:text-gray-900">
                Политика конфиденциальности
              </NuxtLink>
              <NuxtLink :to="`${cityBasePath}/legal/offer`" class="underline decoration-dotted hover:text-gray-900">
                Публичная оферта
              </NuxtLink>
              <NuxtLink :to="`${cityBasePath}/legal/consent`" class="underline decoration-dotted hover:text-gray-900">
                Согласие на обработку ПДн
              </NuxtLink>
              <NuxtLink :to="`${cityBasePath}/legal/contacts`" class="underline decoration-dotted hover:text-gray-900">
                Реквизиты и контакты
              </NuxtLink>
            </div>
            <p class="mt-2 text-gray-500">
              По заказам, отменам и возвратам денежных средств обращайтесь напрямую в ресторан-продавец.
              Оператор платформы не является продавцом блюд и не принимает оплату за рестораны.
            </p>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onServerPrefetch } from 'vue'
import { useRoute } from 'vue-router'
import { useTelegram } from './composables/useTelegram'
import { useTenant } from './composables/useTenant'

const { isTelegram } = useTelegram()
const { cssVars, loadTenantSettings, tenant } = useTenant()
const route = useRoute()

const rootStyle = computed(() => cssVars.value)
const isStorefrontRoute = computed(() => {
  const routePath = typeof route.path === 'string' ? route.path : ''
  if (routePath.startsWith('/dashboard') || routePath.startsWith('/platform')) return false
  const citySlug = route.params?.city_slug

  const hasCitySlug = Array.isArray(citySlug)
    ? citySlug.length > 0
    : typeof citySlug === 'string' && citySlug.length > 0

  if (!hasCitySlug) {
    return false
  }
  return true
})
const tenantLegalName = computed(() => tenant.value.legalName || null)
const tenantInn = computed(() => tenant.value.inn || null)
const tenantOgrn = computed(() => tenant.value.ogrn || null)
const cityBasePath = computed(() => {
  const citySlug = route.params?.city_slug
  const city = Array.isArray(citySlug) ? citySlug[0] : citySlug
  if (typeof city !== 'string' || !city) return ''
  return `/${city}`
})

onMounted(async () => {
  const routePath = typeof route.path === 'string' ? route.path : ''
  const isDashboard = routePath.startsWith('/dashboard')
    || (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard'))
  if (isDashboard) return
  try {
    await loadTenantSettings()
  } catch {
    // Tenant theming is best-effort; app keeps default theme on failure.
  }
})

onServerPrefetch(async () => {
  const routePath = typeof route.path === 'string' ? route.path : ''
  const isDashboard = routePath.startsWith('/dashboard')
  if (isDashboard) return
  try {
    await loadTenantSettings()
  } catch {
    // best-effort: keep default theme
  }
})
</script>
