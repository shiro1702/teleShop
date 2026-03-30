<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Заказы</h1>
        <p class="mt-1 text-sm text-gray-600">Операционный список и канбан по статусам (данные из Supabase).</p>
      </div>
      <p class="text-sm text-gray-600">Найдено: {{ filteredOrders.length }}</p>
    </div>

    <div class="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="viewMode === 'table' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
        @click="viewMode = 'table'"
      >
        Таблица
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="viewMode === 'kanban' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
        @click="viewMode = 'kanban'"
      >
        Канбан по статусам
      </button>
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
        <span class="mb-1 block text-gray-600">Филиал</span>
        <select v-model="restaurantId" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="r in restaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Способ получения</span>
        <select v-model="fulfillmentType" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
          <option value="dine-in">В зале</option>
          <option value="qr-menu">QR-меню</option>
          <option value="showcase-order">Витрина</option>
        </select>
      </label>
      <label class="text-sm md:col-span-2">
        <span class="mb-1 block text-gray-600">Город</span>
        <select v-model="city" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="text-sm md:col-span-5">
        <span class="mb-1 block text-gray-600">Статус</span>
        <select v-model="status" class="w-full max-w-xs rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="value in statuses" :key="value" :value="value">{{ statusLabel(value) }}</option>
        </select>
      </label>
    </div>

    <div v-if="!can('orders.view')" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      У вас нет прав на просмотр заказов.
    </div>

    <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ loadError }}
    </div>

    <div v-else-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загрузка заказов…
    </div>

    <template v-else>
      <div v-if="viewMode === 'kanban'" class="overflow-x-auto pb-2">
        <div class="flex min-w-[900px] gap-3">
          <div v-for="col in statuses" :key="col" class="w-56 shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ statusLabel(col) }}
              <span class="font-normal text-gray-400">({{ ordersInColumn(col).length }})</span>
            </p>
            <div class="space-y-2">
              <NuxtLink
                v-for="order in ordersInColumn(col)"
                :key="order.id"
                :to="`/dashboard/orders/${order.id}`"
                class="block rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-sm transition hover:border-primary"
              >
                <p class="font-mono text-xs text-gray-500">{{ shortId(order.id) }}</p>
                <p class="mt-0.5 font-medium text-gray-900">{{ order.restaurantName }}</p>
                <p class="text-xs text-gray-500">{{ fulfillmentLabel(order.fulfillmentType) }}</p>
                <p class="mt-1 text-xs text-gray-600">{{ order.total }} ₽</p>
              </NuxtLink>
              <p v-if="!ordersInColumn(col).length" class="px-1 py-4 text-center text-xs text-gray-400">Пусто</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div v-if="!pagedOrders.length" class="p-4 text-sm text-gray-600">
          По выбранным фильтрам заказов нет.
        </div>
        <table v-else class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th class="px-3 py-2">ID</th>
              <th class="px-3 py-2">Клиент</th>
              <th class="px-3 py-2">Город / Филиал</th>
              <th class="px-3 py-2">Способ</th>
              <th class="px-3 py-2">Сумма</th>
              <th class="px-3 py-2">Статус</th>
              <th class="px-3 py-2">Действие</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="order in pagedOrders" :key="order.id">
              <td class="px-3 py-2 font-mono text-xs font-medium text-gray-900">{{ shortId(order.id) }}</td>
              <td class="px-3 py-2">
                <p class="font-medium text-gray-900">
                  {{ order.customerTelegramId != null ? `Telegram ${order.customerTelegramId}` : 'Клиент' }}
                </p>
                <p v-if="order.customerProfileId" class="text-xs text-gray-500">Профиль: {{ shortId(order.customerProfileId) }}</p>
              </td>
              <td class="px-3 py-2">
                <p>{{ order.cityName }}</p>
                <p class="text-xs text-gray-500">{{ order.restaurantName }}</p>
              </td>
              <td class="px-3 py-2 text-xs">{{ fulfillmentLabel(order.fulfillmentType) }}</td>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({ layout: 'dashboard' })

const { can } = useDashboardAccess()

type DashboardOrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'

type ListOrder = {
  id: string
  shopId: string
  restaurantId: string | null
  restaurantName: string
  cityId: string | null
  cityName: string
  brand: string
  status: DashboardOrderStatus
  fulfillmentType: string
  total: number
  itemsCount: number
  createdAt: string
  customerTelegramId: number | null
  customerProfileId: string | null
}

type RestaurantRow = {
  id: string
  name: string
}

const viewMode = ref<'table' | 'kanban'>('table')
const period = ref<'all' | 'today' | 'week'>('all')
const restaurantId = ref('all')
const fulfillmentType = ref('all')
const city = ref('all')
const status = ref<'all' | DashboardOrderStatus>('all')
const page = ref(1)
const pageSize = 10

const restaurants = ref<RestaurantRow[]>([])
const orders = ref<ListOrder[]>([])
const pending = ref(true)
const loadError = ref<string | null>(null)

const statuses: DashboardOrderStatus[] = ['new', 'in_progress', 'done', 'cancelled']

const cityOptions = computed(() => {
  const set = new Set<string>()
  for (const o of orders.value) {
    if (o.cityName && o.cityName !== '—') set.add(o.cityName)
  }
  return Array.from(set).sort()
})

async function loadRestaurants() {
  try {
    const res = await fetch('/api/dashboard/restaurants')
    const data = await res.json() as { ok?: boolean; items?: RestaurantRow[] }
    if (data.ok && Array.isArray(data.items)) {
      restaurants.value = data.items
    }
  } catch {
    /* ignore */
  }
}

function buildQuery(): string {
  const p = new URLSearchParams()
  p.set('period', period.value)
  if (restaurantId.value !== 'all') p.set('restaurant_id', restaurantId.value)
  if (fulfillmentType.value !== 'all') p.set('fulfillment_type', fulfillmentType.value)
  if (status.value !== 'all') p.set('status', status.value)
  return p.toString()
}

async function loadOrders() {
  if (!can('orders.view')) {
    pending.value = false
    return
  }
  pending.value = true
  loadError.value = null
  try {
    const qs = buildQuery()
    const res = await fetch(`/api/dashboard/orders?${qs}`)
    const data = await res.json() as { ok?: boolean; items?: ListOrder[]; statusMessage?: string }
    if (!res.ok) {
      throw new Error(data.statusMessage || 'Не удалось загрузить заказы')
    }
    orders.value = Array.isArray(data.items) ? data.items : []
  } catch (e: any) {
    loadError.value = e?.message || 'Ошибка загрузки'
    orders.value = []
  } finally {
    pending.value = false
  }
}

onMounted(async () => {
  await loadRestaurants()
  await loadOrders()
})

watch([period, restaurantId, fulfillmentType, status], () => {
  page.value = 1
  loadOrders()
})

const filteredOrders = computed(() => {
  let list = orders.value
  if (city.value !== 'all') {
    list = list.filter((o) => o.cityName === city.value)
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))
const pagedOrders = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

watch(totalPages, (value) => {
  if (page.value > value) page.value = value
})

function ordersInColumn(col: DashboardOrderStatus) {
  return filteredOrders.value.filter((o) => o.status === col)
}

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function statusLabel(value: DashboardOrderStatus) {
  return (
    {
      new: 'Новый',
      in_progress: 'В работе',
      done: 'Выполнен',
      cancelled: 'Отменён',
    } as Record<DashboardOrderStatus, string>
  )[value]
}

function statusClass(value: DashboardOrderStatus) {
  if (value === 'done') return 'bg-green-100 text-green-700'
  if (value === 'cancelled') return 'bg-red-100 text-red-700'
  if (value === 'in_progress') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

function fulfillmentLabel(ft: string) {
  const m: Record<string, string> = {
    delivery: 'Доставка',
    pickup: 'Самовывоз',
    'dine-in': 'В зале',
    'qr-menu': 'QR-меню',
    'showcase-order': 'Витрина',
  }
  return m[ft] || ft
}
</script>
