<template>
  <div class="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white text-gray-900">
    <header class="border-b border-amber-100 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <NuxtLink :to="festivalLink" class="text-sm font-medium text-amber-700 hover:text-amber-800">
          ← На фестиваль
        </NuxtLink>
        <h1 class="text-lg font-semibold">Достижения</h1>
        <div class="w-24"></div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <div v-if="pending" class="text-center text-sm text-gray-500 py-10">
        Загружаем достижения...
      </div>
      <div v-else-if="error" class="text-center text-sm text-red-500 py-10">
        Ошибка при загрузке. Попробуйте обновить страницу.
      </div>
      <div v-else-if="!achievements.length" class="text-center text-sm text-gray-500 py-10">
        Пока нет доступных достижений.
      </div>
      <template v-else>
        <!-- Мотивационный баннер, если пользователь не авторизован -->
        <div v-if="!user" class="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-blue-900">Вы не авторизованы</p>
            <p class="text-xs text-blue-800 mt-1">Войдите в аккаунт, чтобы собирать достижения и получать награды!</p>
          </div>
        </div>

        <article
          v-for="item in achievements"
          :key="item.id"
          class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm transition-all"
          :class="{'opacity-80': item.isCompleted, 'ring-2 ring-amber-400': item.isCompleted}"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex gap-3">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
                :class="item.isCompleted ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'"
              >
                <span v-if="item.iconUrl">
                  <img :src="item.iconUrl" alt="" class="h-full w-full object-cover rounded-full" />
                </span>
                <span v-else>🏆</span>
              </div>
              <div>
                <p class="text-sm font-semibold" :class="item.isCompleted ? 'text-amber-900' : 'text-gray-900'">
                  {{ item.title }}
                </p>
                <p class="mt-1 text-xs text-gray-600">{{ item.description }}</p>
                <p v-if="item.points > 0" class="mt-1 text-[10px] font-semibold text-amber-600">
                  Награда: {{ item.points }} баллов
                </p>
              </div>
            </div>
            
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span 
                class="rounded-full border px-2 py-1 text-xs font-semibold"
                :class="item.isCompleted ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-200 bg-gray-50 text-gray-700'"
              >
                {{ item.progress }} / {{ item.maxProgress }}
              </span>
              <span v-if="item.isCompleted" class="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                ✓ Выполнено
              </span>
            </div>
          </div>
          
          <div class="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="item.isCompleted ? 'bg-amber-500' : 'bg-amber-400'"
              :style="{ width: `${Math.min(100, (item.progress / item.maxProgress) * 100)}%` }"
            />
          </div>
        </article>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// @ts-ignore
const user = useSupabaseUser()
const route = useRoute()
const citySlug = computed(() => (typeof route.params.city_slug === 'string' ? route.params.city_slug : ''))
const festivalSlug = computed(() => (typeof route.params.festival_slug === 'string' ? route.params.festival_slug : ''))

const festivalLink = computed(() => `/${citySlug.value}/festival/${festivalSlug.value}/`)

const apiUrl = computed(() => `/api/festival/${festivalSlug.value}/achievements`)

const { data, pending, error } = await useFetch(apiUrl.value, {
  key: `festival-achievements-${festivalSlug.value}`,
})

const achievements = computed(() => {
  if (!data.value || !data.value.ok || !Array.isArray(data.value.items)) {
    return []
  }
  return data.value.items
})
</script>
