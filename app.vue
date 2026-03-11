<template>
  <div
    :class="[{ 'tg-miniapp-root': isTelegram }, 'app-root']"
    :style="isTelegram ? {
      minHeight: 'var(--tg-viewport-height)',
      backgroundColor: 'var(--tg-theme-bg-color)',
      color: 'var(--tg-theme-text-color)'
    } : {}"
  >
    <header
      v-if="!isTelegram"
      class="border-b border-gray-200 bg-white"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NuxtLink to="/" class="flex items-center gap-2 text-gray-900">
          <span class="text-sm font-semibold uppercase tracking-wide">JINJI</span>
        </NuxtLink>
        <div class="flex items-center gap-3">
          <span v-if="webUser" class="hidden text-xs text-gray-600 sm:inline">
            Вошли как @{{ webUser.username || webUser.id }}
          </span>
          <TelegramLoginButton
            v-if="!webUser"
            @logged-in="refreshMe"
          />
        </div>
      </div>
    </header>

    <NuxtPage />
    <CartModal v-if="!isTelegram" />
  </div>
</template>

<script setup lang="ts">
const { isTelegram } = useTelegram()

const webUser = ref<{ id: number; username?: string } | null>(null)

async function refreshMe() {
  const res = await $fetch<{ user: any | null }>('/api/auth/me')
  webUser.value = res.user
}

if (import.meta.client) {
  refreshMe()
}
</script>

<style>
.tg-miniapp-root {
  background-color: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}

.tg-miniapp-root a {
  color: var(--tg-theme-link-color, var(--tg-theme-button-color));
}
</style>
