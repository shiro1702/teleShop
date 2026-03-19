<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900" :style="rootStyle">
    <AppHeader />
    <div :class="isTelegram ? '' : 'pt-16'">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

const { isTelegram } = useTelegram()
const { cssVars, loadTenantSettings } = useTenant()

const rootStyle = computed(() => cssVars.value)

onMounted(async () => {
  try {
    await loadTenantSettings()
  } catch {
    // Tenant theming is best-effort; app keeps default theme on failure.
  }
})
</script>
