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

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Город</span>
        <select v-model="cityFilter" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Статус</span>
        <select v-model="statusFilter" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Бренд</span>
        <select v-model="brandFilter" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option value="main">Основной бренд</option>
        </select>
      </label>
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

      <div v-else class="divide-y divide-gray-100">
        <div v-for="group in groupedRestaurants" :key="group.city" class="px-4 py-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{{ group.city }}</p>
          <ul class="space-y-2">
            <li v-for="item in group.items" :key="item.id" class="rounded-lg border border-gray-100 px-2 py-2">
              <div class="flex items-center justify-between gap-3">
                <NuxtLink
                  :to="`/dashboard/branches/${item.id}`"
                  class="min-w-0 flex-1 rounded-lg transition hover:bg-gray-50"
                >
                  <p class="text-sm font-medium text-gray-900">{{ item.name }}</p>
                  <p class="text-xs text-gray-600">{{ item.address }}</p>
                  <p class="mt-1 text-xs text-primary">Открыть редактирование</p>
                </NuxtLink>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
                  >
                    {{ item.isActive ? 'Active' : 'Inactive' }}
                  </span>
                  <button
                    v-if="can('branches.archive')"
                    class="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    @click="archiveBranch(item.id)"
                  >
                    Архивировать
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'

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

const { can } = useDashboardAccess()
const pending = ref(true)
const errorMessage = ref<string | null>(null)
const restaurants = ref<DashboardRestaurant[]>([])
const cityFilter = ref('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const brandFilter = ref<'all' | 'main'>('all')

const cityByAddress = (address: string) => address.split(',')[0]?.trim() || 'Без города'
const cities = computed(() => Array.from(new Set(restaurants.value.map((item) => cityByAddress(item.address)))))
const filteredRestaurants = computed(() => restaurants.value.filter((item) => {
  if (statusFilter.value === 'active' && !item.isActive) return false
  if (statusFilter.value === 'inactive' && item.isActive) return false
  if (cityFilter.value !== 'all' && cityByAddress(item.address) !== cityFilter.value) return false
  if (brandFilter.value !== 'all' && brandFilter.value !== 'main') return false
  return true
}))

const groupedRestaurants = computed(() => {
  const map = new Map<string, DashboardRestaurant[]>()
  filteredRestaurants.value.forEach((item) => {
    const city = cityByAddress(item.address)
    const bucket = map.get(city) || []
    bucket.push(item)
    map.set(city, bucket)
  })
  return Array.from(map.entries()).map(([city, items]) => ({ city, items }))
})

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

function archiveBranch(id: string) {
  const item = restaurants.value.find((entry) => entry.id === id)
  if (!item) return
  const confirmed = window.confirm(`Архивировать филиал "${item.name}"?`)
  if (!confirmed) return
  item.isActive = false
}
</script>
