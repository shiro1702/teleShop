<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Филиалы</h1>
        <p class="mt-2 text-sm text-gray-600">Список филиалов текущей организации.</p>
      </div>
      <NuxtLink
        to="/dashboard/branches/new"
        class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      >
        Создать филиал
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div v-if="pending" class="px-4 py-4 text-sm text-gray-600">
        Загружаем филиалы...
      </div>

      <div v-else-if="errorMessage" class="px-4 py-4 text-sm text-red-600">
        {{ errorMessage }}
      </div>

      <div v-else-if="!restaurants.length" class="px-4 py-4 text-sm text-gray-600">
        Филиалы еще не добавлены.
      </div>

      <ul v-else class="divide-y divide-gray-100">
        <li v-for="item in restaurants" :key="item.id" class="px-4 py-3">
          <NuxtLink
            :to="`/dashboard/branches/${item.id}`"
            class="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition hover:bg-gray-50"
          >
            <div>
              <p class="text-sm font-medium text-gray-900">{{ item.name }}</p>
              <p class="text-xs text-gray-600">{{ item.address }}</p>
              <p class="mt-1 text-xs text-primary">Открыть редактирование</p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                :class="item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
              >
                {{ item.isActive ? 'Active' : 'Inactive' }}
              </span>
              <svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

type DashboardRestaurant = {
  id: string
  name: string
  address: string
  supportsDelivery: boolean
  supportsPickup: boolean
  isActive: boolean
  createdAt: string
}

const pending = ref(true)
const errorMessage = ref<string | null>(null)
const restaurants = ref<DashboardRestaurant[]>([])

onMounted(async () => {
  pending.value = true
  errorMessage.value = null
  try {
    const res = await fetch('/api/dashboard/restaurants')
    if (!res.ok) {
      throw new Error('Не удалось загрузить филиалы')
    }
    const json = await res.json() as { ok: boolean; items: DashboardRestaurant[] }
    if (!json.ok) {
      throw new Error('Некорректный ответ API')
    }
    restaurants.value = Array.isArray(json.items) ? json.items : []
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка загрузки филиалов'
  } finally {
    pending.value = false
  }
})
</script>
