<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900">
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
          <ClientOnly>
            <TelegramLoginButton
              v-if="!webUser"
              @logged-in="refreshMe"
            />
          </ClientOnly>
        </div>
      </div>
    </header>

    <NuxtPage />
    <CartModal />
  </div>
</template>

<script setup lang="ts">
const { isTelegram } = useTelegram()
const webUser = ref<{ id: number; username?: string } | null>(null)

async function refreshMe() {
  console.log('[Auth][WEB] refreshMe() called')
  const res = await $fetch<{ user: any | null }>('/api/auth/me')
  webUser.value = res.user
  console.log('[Auth][WEB] /api/auth/me result:', res)
}

if (import.meta.client) {
  console.log('[Env][WEB] import.meta.client = true')
  console.log('[Env][WEB] isTelegram =', isTelegram.value)
  refreshMe()
}
</script>
