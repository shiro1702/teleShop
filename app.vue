<template>
  <div class="app-root min-h-screen bg-gray-50 text-gray-900">
    <header
      v-if="!isTelegram"
      class="border-b border-gray-200 bg-white"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NuxtLink to="/" class="flex items-center gap-2 text-gray-900">
          <span class="text-sm font-semibold uppercase tracking-wide">пибимпаб</span>
        </NuxtLink>
        <div class="flex items-center gap-3">
          <div
            v-if="user"
            class="relative hidden sm:block z-[51]"
          >
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              @click="toggleUserMenu"
            >
              <span>Вошли через Telegram</span>
              <svg
                class="h-3 w-3 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 text-sm text-gray-700 shadow-lg"
            >
              <NuxtLink
                to="/profile"
                class="block px-3 py-2 hover:bg-gray-50"
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
          <button
            v-else-if="telegramBotUrl"
            type="button"
            class="hidden rounded-lg border border-[#2563eb] px-4 py-2 text-sm font-medium text-[#2563eb] transition hover:bg-blue-50 active:bg-blue-100 sm:inline-block"
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
const supabase = useSupabaseClient()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)

const showUserMenu = ref(false)

function openTelegramAuth() {
  if (!telegramBotUrl.value) return
  if (import.meta.client) {
    const url = `${telegramBotUrl.value}?start=auth_link`
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

if (import.meta.client) {
  console.log('[Env][WEB] import.meta.client = true')
  console.log('[Env][WEB] isTelegram =', isTelegram.value)
}
</script>
