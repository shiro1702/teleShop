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
          <span
            v-if="user"
            class="hidden text-xs text-gray-600 sm:inline"
          >
            Вошли через Telegram (user ID: {{ user.id }})
          </span>
          <button
            v-else-if="telegramBotUrl"
            type="button"
            class="hidden rounded-lg border border-[#2563eb] px-3 py-1.5 text-xs font-medium text-[#2563eb] transition hover:bg-blue-50 active:bg-blue-100 sm:inline-block"
            @click="openTelegramAuth"
          >
            Войти через Telegram
          </button>
        </div>
      </div>
    </header>

    <NuxtPage />
    <CartModal />
  </div>
</template>

<script setup lang="ts">
const { isTelegram } = useTelegram()
const user = useSupabaseUser()
const config = useRuntimeConfig()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)

function openTelegramAuth() {
  if (!telegramBotUrl.value) return
  if (import.meta.client) {
    const url = `${telegramBotUrl.value}?start=auth_link`
    window.open(url, '_blank', 'noopener')
  }
}

if (import.meta.client) {
  console.log('[Env][WEB] import.meta.client = true')
  console.log('[Env][WEB] isTelegram =', isTelegram.value)
}
</script>
