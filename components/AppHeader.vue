<template>
  <header
    v-if="!isTelegram"
    class="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur"
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 text-gray-900">
        <img
          src="/logo.webp"
          alt="Логотип"
          class="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <span class="truncate text-sm font-semibold uppercase tracking-wide sm:text-base">
          пибимпаб
        </span>
      </NuxtLink>

      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Авторизован: на мобилке — иконка, на десктопе — текстовая кнопка -->
        <div
          v-if="user"
          ref="userMenuRootRef"
          class="relative z-[51]"
        >
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 sm:hidden"
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
            class="hidden items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex"
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
const { isTelegram } = useTelegram()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const supabase = useSupabaseClient()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)

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

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('click', onDocumentClickCapture, true)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', onDocumentClickCapture, true)
})
</script>

