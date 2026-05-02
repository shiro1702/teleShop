<template>
  <ClientOnly>
    <div
      v-if="visible"
      class="pointer-events-auto fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-label="Уведомление об использовании файлов cookie"
    >
      <div class="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p class="text-xs leading-relaxed text-gray-600 sm:text-sm">
          Мы используем файлы cookie и локальное хранилище браузера для входа, корзины и работы сайта.
          Подробнее — в
          <NuxtLink :to="privacyPath" class="font-medium text-primary underline decoration-dotted underline-offset-2 hover:text-primary-700">
            Политике конфиденциальности
          </NuxtLink>
          и на странице
          <NuxtLink :to="cookiesPath" class="font-medium text-primary underline decoration-dotted underline-offset-2 hover:text-primary-700">
            о cookie
          </NuxtLink>
          .
        </p>
        <button
          type="button"
          class="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          @click="accept"
        >
          Понятно
        </button>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const STORAGE_KEY = 'pocketmenu_cookie_consent_v1'

defineProps<{
  privacyPath: string
  cookiesPath: string
}>()

const visible = ref(false)

onMounted(() => {
  try {
    if (typeof localStorage === 'undefined') {
      visible.value = true
      return
    }
    if (!localStorage.getItem(STORAGE_KEY)) visible.value = true
  } catch {
    visible.value = true
  }
})

function accept() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ acceptedAt: new Date().toISOString(), v: 1 }),
    )
  } catch {
    // ignore
  }
  visible.value = false
}
</script>
