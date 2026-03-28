<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900" :style="rootStyle">
    <AppHeader />
    <div :class="isTelegram ? '' : 'pt-16'">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onServerPrefetch } from 'vue'
import { useRoute } from 'vue-router'
import { useTelegram } from './composables/useTelegram'
import { useTenant } from './composables/useTenant'

const { isTelegram } = useTelegram()
const { cssVars, loadTenantSettings } = useTenant()
const route = useRoute()

const rootStyle = computed(() => cssVars.value)

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
