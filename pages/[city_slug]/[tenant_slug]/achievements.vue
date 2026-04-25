<template>
  <div class="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white text-gray-900">
    <header class="border-b border-amber-100 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <NuxtLink :to="tenantPath('/')" class="text-sm font-medium text-amber-700 hover:text-amber-800">
          ← К меню
        </NuxtLink>
        <h1 class="text-lg font-semibold">Достижения фестиваля</h1>
        <span class="text-xs text-amber-700">Demo</span>
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <article
        v-for="item in achievements"
        :key="item.id"
        class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-amber-900">{{ item.title }}</p>
            <p class="mt-1 text-xs text-amber-700">{{ item.description }}</p>
          </div>
          <span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            {{ item.progress }}%
          </span>
        </div>
        <div class="mt-3 h-2 rounded-full bg-amber-100">
          <div
            class="h-full rounded-full bg-amber-500 transition-all"
            :style="{ width: `${item.progress}%` }"
          />
        </div>
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useTenant } from '~/composables/useTenant'

const { tenantPath } = useTenant()

const achievements = [
  { id: 'gastro-tourist', title: 'Гастро-турист', description: 'Попробуйте блюда у 5 разных корнеров.', progress: 60 },
  { id: 'flash', title: 'Флэш', description: 'Забирайте заказы быстрее 8 минут.', progress: 35 },
  { id: 'legend', title: 'Легенда фестиваля', description: 'Соберите 10 заказов за фестиваль.', progress: 80 },
]
</script>
