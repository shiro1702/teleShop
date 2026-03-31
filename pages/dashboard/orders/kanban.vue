<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Канбан заказов</h1>
        <p class="mt-1 text-sm text-gray-600">Операционный канбан с быстрыми сменами статуса.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">Канбан</span>
        <NuxtLink to="/dashboard/orders/manager" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Менеджер
        </NuxtLink>
      </div>
    </div>

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
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
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Город</span>
        <select v-model="city" class="w-full rounded-lg border border-gray-300 px-2 py-2">
          <option value="all">Все</option>
          <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
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

    <div v-else class="overflow-x-auto pb-2 snap-x snap-mandatory sm:snap-none">
      <div class="flex min-w-[1280px] gap-3 px-[calc(50vw-8rem)] sm:px-0">
        <div v-for="col in kanbanColumns" :key="col" class="w-72 shrink-0 snap-center rounded-xl border border-gray-200 bg-gray-50 p-3 sm:snap-start">
          <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ statusLabel(col) }}
            <span class="font-normal text-gray-400">({{ ordersInColumn(col).length }})</span>
          </p>
          <div class="space-y-2">
            <div
              v-for="order in ordersInColumn(col)"
              :key="order.id"
              class="rounded-lg border border-gray-200 bg-white p-3 text-base shadow-sm"
            >
              <NuxtLink :to="`/dashboard/orders/${order.id}`" class="block hover:text-primary">
                <p class="font-mono text-sm text-gray-500">{{ displayOrderNumber(order) }}</p>
                <p class="mt-1 text-base font-semibold text-gray-900">{{ order.restaurantName }}</p>
                <p class="text-sm text-gray-500">{{ fulfillmentLabel(order.fulfillmentType) }}</p>
                <p class="mt-1.5 text-sm text-gray-700">{{ order.total }} ₽</p>
                <ul v-if="order.itemsPreview?.length" class="mt-2.5 space-y-1 text-sm text-gray-700">
                  <li v-for="(item, idx) in order.itemsPreview" :key="`${order.id}:item:${idx}`">
                    {{ item.name }} × {{ item.quantity }}
                  </li>
                </ul>
              </NuxtLink>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <button
                  v-for="next in quickTargets(order)"
                  :key="`${order.id}:${next}`"
                  class="rounded border px-2.5 py-1 text-sm disabled:opacity-50"
                  :class="actionButtonClass(next)"
                  :disabled="isSaving(order.id)"
                  @click="applyStatus(order.id, next)"
                >
                  {{ statusLabel(next) }}
                </button>
              </div>
            </div>
            <p v-if="!ordersInColumn(col).length" class="px-1 py-4 text-center text-xs text-gray-400">Пусто</p>
          </div>
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
  itemsPreview?: Array<{ name: string; quantity: number }>
  itemsCount?: number
}
type RestaurantRow = { id: string; name: string; supportsDelivery?: boolean }

const route = useRoute()
const router = useRouter()
const { can } = useDashboardAccess()

const period = ref<'all' | 'today' | 'week'>('all')
const restaurantId = ref('all')
const fulfillmentType = ref('all')
const city = ref('all')

const restaurants = ref<RestaurantRow[]>([])
const orders = ref<ListOrder[]>([])
const pending = ref(true)
const loadError = ref<string | null>(null)
const savingByOrder = ref<Record<string, boolean>>({})
let pollHandle: number | null = null

/** В канбане не показываем финальный «Выдан», чтобы доска не захламлялась. */
const kanbanColumns = computed((): DashboardOrderStatus[] => {
  const selectedRestaurant =
    restaurantId.value !== 'all' ? restaurants.value.find((r) => r.id === restaurantId.value) : null
  const deliveryAllowedByRestaurant = selectedRestaurant ? !!selectedRestaurant.supportsDelivery : true
  const ft = fulfillmentType.value
  const showDeliveryColumn = deliveryAllowedByRestaurant && (ft === 'all' || ft === 'delivery')
  if (ft === 'delivery') {
    return showDeliveryColumn ? ['new', 'in_progress', 'out_for_delivery', 'cancelled'] : ['new', 'in_progress', 'cancelled']
  }
  if (ft === 'pickup' || ft === 'qr-menu') {
    return ['new', 'in_progress', 'ready_for_pickup', 'cancelled']
  }
  return showDeliveryColumn
    ? ['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery', 'cancelled']
    : ['new', 'in_progress', 'ready_for_pickup', 'cancelled']
})

function statusLabel(value: DashboardOrderStatus) {
  return dashboardOrderStatusLabels[value]
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

function actionButtonClass(next: DashboardOrderStatus) {
  if (next === 'cancelled') {
    return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
}

function syncFiltersToQuery() {
  const q: Record<string, string> = {}
  q.view = 'kanban'
  if (period.value !== 'all') q.period = period.value
  if (restaurantId.value !== 'all') q.restaurant_id = restaurantId.value
  if (fulfillmentType.value !== 'all') q.fulfillment_type = fulfillmentType.value
  if (city.value !== 'all') q.city = city.value
  void router.replace({ query: q })
}

function buildApiQuery() {
  const p = new URLSearchParams()
  p.set('period', period.value)
  if (restaurantId.value !== 'all') p.set('restaurant_id', restaurantId.value)
  if (fulfillmentType.value !== 'all') p.set('fulfillment_type', fulfillmentType.value)
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
  return list.filter((o) => o.status !== 'handed_to_customer')
})

function ordersInColumn(col: DashboardOrderStatus) {
  return filteredOrders.value.filter((o) => o.status === col)
}

watch([period, restaurantId, fulfillmentType, city], () => {
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
