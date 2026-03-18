<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900">
    <AppHeader />
    <div :class="isTelegram ? '' : 'pt-16'">
      <NuxtPage />
    </div>
    <CartModal />
  </div>
</template>

<script setup lang="ts">
const { isTelegram } = useTelegram()
</script>
