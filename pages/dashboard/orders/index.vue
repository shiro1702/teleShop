<template>
  <section class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Заказы</h1>
        <p class="mt-1 text-sm text-gray-600">Операционный список заказов с фильтрами и статусами.</p>
      </div>
      <p class="text-sm text-gray-600">Найдено: {{ filteredOrders.length }}</p>
    </div>

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Период</span>
        <select v-model="period" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option value="today">Сегодня</option>
          <option value="week">7 дней</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Бренд</span>
        <select v-model="brand" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="value in brands" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Город</span>
        <select v-model="city" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="value in cities" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Филиал</span>
        <select v-model="branch" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="value in branches" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Статус</span>
        <select v-model="status" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="value in statuses" :key="value" :value="value">{{ statusLabel(value) }}</option>
        </select>
      </label>
    </div>

    <div class="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <p class="text-sm font-medium text-gray-900">Канбан в roadmap</p>
      <p class="mt-1 text-sm text-gray-600">Для MVP зафиксирован список колонок и права перемещения. Drag-and-drop будет следующим этапом.</p>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div v-if="!can('orders.view')" class="p-4 text-sm text-red-700">
        У вас нет прав на просмотр заказов.
      </div>
      <div v-else-if="!pagedOrders.length" class="p-4 text-sm text-gray-600">
        По выбранным фильтрам заказов нет.
      </div>
      <table v-else class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2">ID</th>
            <th class="px-3 py-2">Клиент</th>
            <th class="px-3 py-2">Город / Филиал</th>
            <th class="px-3 py-2">Сумма</th>
            <th class="px-3 py-2">Статус</th>
            <th class="px-3 py-2">Действие</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="order in pagedOrders" :key="order.id">
            <td class="px-3 py-2 font-medium text-gray-900">{{ order.id }}</td>
            <td class="px-3 py-2">
              <p class="font-medium text-gray-900">{{ order.customerName }}</p>
              <p class="text-xs text-gray-500">{{ order.phone }}</p>
            </td>
            <td class="px-3 py-2">
              <p>{{ order.city }}</p>
              <p class="text-xs text-gray-500">{{ order.branch }}</p>
            </td>
            <td class="px-3 py-2">{{ order.total }} ₽</td>
            <td class="px-3 py-2">
              <span class="rounded-full px-2 py-0.5 text-xs" :class="statusClass(order.status)">
                {{ statusLabel(order.status) }}
              </span>
            </td>
            <td class="px-3 py-2">
              <NuxtLink :to="`/dashboard/orders/${order.id}`" class="text-primary hover:underline">
                Открыть
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
        <p>Страница {{ page }} из {{ totalPages }}</p>
        <div class="space-x-2">
          <button class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50" :disabled="page <= 1" @click="page--">Назад</button>
          <button class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50" :disabled="page >= totalPages" @click="page++">Вперед</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { dashboardOrders, type DashboardOrderStatus } from '~/data/dashboardMock'

definePageMeta({ layout: 'dashboard' })

const { can } = useDashboardAccess()

const period = ref<'all' | 'today' | 'week'>('all')
const brand = ref('all')
const city = ref('all')
const branch = ref('all')
const status = ref<'all' | DashboardOrderStatus>('all')
const page = ref(1)
const pageSize = 4

const brands = Array.from(new Set(dashboardOrders.map((item) => item.brand)))
const cities = Array.from(new Set(dashboardOrders.map((item) => item.city)))
const branches = Array.from(new Set(dashboardOrders.map((item) => item.branch)))
const statuses: DashboardOrderStatus[] = ['new', 'confirmed', 'preparing', 'delivering', 'done', 'cancelled']

const filteredOrders = computed(() => {
  const now = new Date('2026-03-24T23:59:00Z')
  return dashboardOrders.filter((item) => {
    if (brand.value !== 'all' && item.brand !== brand.value) return false
    if (city.value !== 'all' && item.city !== city.value) return false
    if (branch.value !== 'all' && item.branch !== branch.value) return false
    if (status.value !== 'all' && item.status !== status.value) return false
    if (period.value === 'today') {
      const created = new Date(item.createdAt)
      if (created.toDateString() !== now.toDateString()) return false
    }
    if (period.value === 'week') {
      const created = new Date(item.createdAt).getTime()
      if (created < now.getTime() - 7 * 24 * 60 * 60 * 1000) return false
    }
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))
const pagedOrders = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

watch([period, brand, city, branch, status], () => {
  page.value = 1
})

watch(totalPages, (value) => {
  if (page.value > value) page.value = value
})

function statusLabel(value: DashboardOrderStatus) {
  return ({
    new: 'Новый',
    confirmed: 'Подтвержден',
    preparing: 'Готовится',
    delivering: 'Доставляется',
    done: 'Выполнен',
    cancelled: 'Отменен',
  } as Record<DashboardOrderStatus, string>)[value]
}

function statusClass(value: DashboardOrderStatus) {
  if (value === 'done') return 'bg-green-100 text-green-700'
  if (value === 'cancelled') return 'bg-red-100 text-red-700'
  if (value === 'delivering') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}
</script>
