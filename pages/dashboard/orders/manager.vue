<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Заказы менеджера</h1>
        <p class="mt-1 text-sm text-gray-600">Табличный режим с фильтрами и быстрым изменением статусов.</p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/dashboard/orders/kanban" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Канбан
        </NuxtLink>
        <span class="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">Менеджер</span>
      </div>
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
          <option value="qr-menu">QR-меню</option>
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
            <th class="px-3 py-2">Быстро</th>
            <th class="px-3 py-2">Детали</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="order in pagedOrders" :key="order.id">
            <td class="px-3 py-2">
              <p class="font-mono text-xs font-medium text-gray-900">{{ displayOrderNumber(order) }}</p>
              <p class="font-mono text-[10px] text-gray-400">{{ shortId(order.id) }}</p>
            </td>
            <td class="px-3 py-2">
              <p class="font-medium text-gray-900">
                {{ order.customerTelegramId != null ? `Telegram ${order.customerTelegramId}` : 'Клиент' }}
              </p>
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
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="next in quickTargets(order)"
                  :key="`${order.id}:${next}`"
                  class="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="isSaving(order.id)"
                  @click="applyStatus(order.id, next)"
                >
                  {{ statusLabel(next) }}
                </button>
              </div>
            </td>
            <td class="px-3 py-2">
              <NuxtLink :to="`/dashboard/orders/${order.id}`" class="text-primary hover:underline">Открыть</NuxtLink>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  dashboardOrderStatusLabels,
  getAllowedOrderStatusTransitions,
  type DashboardOrderStatus,
} from '~/utils/dashboardOrderStatus'

definePageMeta({ layout: 'dashboard' })

type ListOrder = {
  id: string
  orderNumber?: string | null
  restaurantName: string
  cityName: string
  status: DashboardOrderStatus
  fulfillmentType: string
  total: number
  customerTelegramId: number | null
}
type RestaurantRow = { id: string; name: string }

const route = useRoute()
const router = useRouter()
const { can } = useDashboardAccess()

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
const savingByOrder = ref<Record<string, boolean>>({})
let pollHandle: number | null = null

const statuses: DashboardOrderStatus[] = [
  'new',
  'in_progress',
  'ready_for_pickup',
  'out_for_delivery',
  'handed_to_customer',
  'cancelled',
]

function statusLabel(value: DashboardOrderStatus) {
  return dashboardOrderStatusLabels[value]
}

function statusClass(value: DashboardOrderStatus) {
  if (value === 'handed_to_customer') return 'bg-green-100 text-green-700'
  if (value === 'cancelled') return 'bg-red-100 text-red-700'
  if (value === 'in_progress') return 'bg-blue-100 text-blue-700'
  if (value === 'ready_for_pickup') return 'bg-amber-100 text-amber-900'
  if (value === 'out_for_delivery') return 'bg-violet-100 text-violet-800'
  return 'bg-gray-100 text-gray-700'
}

function fulfillmentLabel(ft: string) {
  const m: Record<string, string> = {
    delivery: 'Доставка',
    pickup: 'Самовывоз',
    'qr-menu': 'QR-меню',
  }
  return m[ft] || ft
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function displayOrderNumber(order: ListOrder) {
  return order.orderNumber && order.orderNumber.trim() ? order.orderNumber : shortId(order.id)
}

function quickTargets(order: ListOrder): DashboardOrderStatus[] {
  return getAllowedOrderStatusTransitions(order.status, order.fulfillmentType)
}

function isSaving(orderId: string) {
  return !!savingByOrder.value[orderId]
}

async function loadRestaurants() {
  try {
    const res = await fetch('/api/dashboard/restaurants')
    const data = (await res.json()) as { ok?: boolean; items?: RestaurantRow[] }
    if (data.ok && Array.isArray(data.items)) restaurants.value = data.items
  } catch {
    // ignore
  }
}

function initFiltersFromQuery() {
  const q = route.query
  period.value = q.period === 'today' || q.period === 'week' ? q.period : 'all'
  restaurantId.value = typeof q.restaurant_id === 'string' && q.restaurant_id.trim() ? q.restaurant_id : 'all'
  fulfillmentType.value = typeof q.fulfillment_type === 'string' && q.fulfillment_type.trim() ? q.fulfillment_type : 'all'
  city.value = typeof q.city === 'string' && q.city.trim() ? q.city : 'all'
  status.value =
    typeof q.status === 'string' &&
    ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery', 'handed_to_customer', 'cancelled'].includes(q.status)
      ? (q.status as DashboardOrderStatus)
      : 'all'
}

function syncFiltersToQuery() {
  const q: Record<string, string> = {}
  q.view = 'manager'
  if (period.value !== 'all') q.period = period.value
  if (restaurantId.value !== 'all') q.restaurant_id = restaurantId.value
  if (fulfillmentType.value !== 'all') q.fulfillment_type = fulfillmentType.value
  if (city.value !== 'all') q.city = city.value
  if (status.value !== 'all') q.status = status.value
  void router.replace({ query: q })
}

function buildApiQuery() {
  const p = new URLSearchParams()
  p.set('period', period.value)
  if (restaurantId.value !== 'all') p.set('restaurant_id', restaurantId.value)
  if (fulfillmentType.value !== 'all') p.set('fulfillment_type', fulfillmentType.value)
  if (status.value !== 'all') p.set('status', status.value)
  return p.toString()
}

async function loadOrders({ silent = false }: { silent?: boolean } = {}) {
  if (!can('orders.view')) {
    pending.value = false
    return
  }
  if (!silent) pending.value = true
  loadError.value = null
  try {
    const res = await fetch(`/api/dashboard/orders?${buildApiQuery()}`)
    const data = (await res.json()) as { ok?: boolean; items?: ListOrder[]; statusMessage?: string }
    if (!res.ok) throw new Error(data.statusMessage || 'Не удалось загрузить заказы')
    orders.value = Array.isArray(data.items) ? data.items : []
  } catch (e: any) {
    loadError.value = e?.message || 'Ошибка загрузки'
    if (!silent) orders.value = []
  } finally {
    if (!silent) pending.value = false
  }
}

async function applyStatus(orderId: string, nextStatus: DashboardOrderStatus) {
  const needsComment = nextStatus === 'cancelled'
  let comment: string | undefined
  if (needsComment) {
    const raw = window.prompt('Комментарий к отмене (обязательно):', '')
    if (!raw || !raw.trim()) return
    comment = raw.trim()
  }

  savingByOrder.value = { ...savingByOrder.value, [orderId]: true }
  try {
    const res = await fetch(`/api/dashboard/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextStatus, comment }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok) throw new Error(json?.statusMessage || 'Не удалось обновить статус')
    await loadOrders({ silent: true })
  } catch (e: any) {
    window.alert(e?.message || 'Ошибка изменения статуса')
  } finally {
    const copy = { ...savingByOrder.value }
    delete copy[orderId]
    savingByOrder.value = copy
  }
}

const cityOptions = computed(() => {
  const set = new Set<string>()
  for (const o of orders.value) {
    if (o.cityName && o.cityName !== '—') set.add(o.cityName)
  }
  return Array.from(set).sort()
})

const filteredOrders = computed(() => {
  let list = orders.value
  if (city.value !== 'all') list = list.filter((o) => o.cityName === city.value)
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

watch([period, restaurantId, fulfillmentType, city, status], () => {
  page.value = 1
  syncFiltersToQuery()
  void loadOrders()
})

onMounted(async () => {
  initFiltersFromQuery()
  await loadRestaurants()
  await loadOrders()
  pollHandle = window.setInterval(() => void loadOrders({ silent: true }), 3000)
})

onBeforeUnmount(() => {
  if (pollHandle != null) {
    window.clearInterval(pollHandle)
    pollHandle = null
  }
})
</script>
