<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Мои заказы</h1>
      <p class="mt-1 text-sm text-gray-600">
        История заказов по разным ресторанам, с выделением активных.
      </p>
    </header>

    <section v-if="selectedOrderId" class="mb-6 rounded-xl border border-primary-100 bg-white p-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Статус заказа</h2>
          <p class="mt-1 text-sm text-gray-600">
            Заказ: <span class="font-medium">{{ selectedOrderId.slice(0, 8) }}</span>
          </p>
          <p class="mt-1 text-xs text-gray-500">Обновляется автоматически</p>
        </div>

        <span
          v-if="detailOrder"
          class="rounded-full px-2.5 py-1 text-xs font-medium"
          :class="detailStatusClass(detailOrder.status)"
        >
          {{ statusLabel(detailOrder.status) }}
        </span>
      </div>

      <div v-if="detailErrorMessage" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ detailErrorMessage }}
      </div>

      <div v-else-if="detailOrder" class="mt-4">
        <p class="text-sm text-gray-700">
          Ресторан: <span class="font-medium">{{ detailOrder.restaurantName }}</span>
        </p>
        <p class="mt-1 text-sm text-gray-700">
          Итого: <span class="font-semibold text-primary">{{ formatPrice(detailOrder.total) }}</span>
        </p>

        <div v-if="detailOrder.timeline?.length" class="mt-4">
          <h3 class="text-sm font-semibold text-gray-900">Этапы</h3>
          <ul class="mt-2 space-y-2 text-sm text-gray-700">
            <li v-for="(t, idx) in detailOrder.timeline" :key="`${t.at}-${idx}`" class="flex items-center justify-between gap-3">
              <span>{{ t.label }}</span>
              <span class="text-xs text-gray-500">{{ formatAt(t.at) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загружаем заказы...
    </div>

    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <template v-else>
      <section class="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Поиск ресторана</span>
            <input
              v-model.trim="query"
              type="text"
              placeholder="Например: Суши"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
          </label>

          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Статус</span>
            <select
              v-model="statusFilter"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Все</option>
              <option value="active">Только активные</option>
              <option value="history">Только завершенные</option>
            </select>
          </label>

          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Сортировка</span>
            <select
              v-model="sortBy"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="amount">По сумме</option>
            </select>
          </label>
        </div>
      </section>

      <section v-if="activeOrders.length" class="mb-6">
        <h2 class="mb-3 text-lg font-semibold text-gray-900">Активные заказы</h2>
        <ul class="space-y-3">
          <li
            v-for="order in activeOrders"
            :key="order.id"
            class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <OrderCard :order="order" />
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold text-gray-900">Все заказы</h2>
        <div v-if="!filteredOrders.length" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          По выбранным фильтрам заказов не найдено.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="order in filteredOrders"
            :key="order.id"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <OrderCard :order="order" />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useRoute } from 'vue-router'
import { useTenant } from '~/composables/useTenant'
import { useTelegram } from '~/composables/useTelegram'

type ClientOrder = {
  id: string
  restaurantName: string
  status: string
  isActive: boolean
  fulfillmentType: string
  paymentMethod: string
  total: number
  deliveryCost: number
  itemsCount: number
  itemsPreview?: Array<{ name: string; quantity: number }>
  createdAt: string
}

const query = ref('')
const statusFilter = ref<'all' | 'active' | 'history'>('all')
const sortBy = ref<'newest' | 'oldest' | 'amount'>('newest')

const pending = ref(true)
const errorMessage = ref('')
const data = ref<{ ok: boolean; items: ClientOrder[] }>({ ok: true, items: [] })

const route = useRoute()
const { tenantKey } = useTenant()
const { isTelegram, webApp } = useTelegram()

const selectedOrderId = computed(() => {
  const raw = route.query.orderId
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
})

type ClientOrderStatusDetail = {
  id: string
  status: string
  fulfillmentType: string
  paymentMethod: string
  subtotal: number
  deliveryCost: number
  total: number
  restaurantName: string
  createdAt: string
  timeline: Array<{ at: string; label: string }>
}

const detailErrorMessage = ref('')
const detailOrder = ref<ClientOrderStatusDetail | null>(null)
let detailPollHandle: number | null = null
type NormalizedOrder = ClientOrder & {
  statusText: string
  paymentText: string
  fulfillmentText: string
  createdAtText: string
  totalText: string
}

function requestHeaders() {
  const headers: Record<string, string> = {}
  if (typeof tenantKey.value === 'string' && tenantKey.value.trim()) {
    headers['x-shop-id'] = tenantKey.value.trim()
  }
  if (isTelegram.value && webApp.value?.initData) {
    headers['x-telegram-init-data'] = webApp.value.initData
  }
  return headers
}

function detailStatusClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'cancelled') return 'bg-red-100 text-red-700'
  if (s === 'handed_to_customer' || s === 'done') return 'bg-green-100 text-green-700'
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700'
  if (s === 'ready_for_pickup') return 'bg-amber-100 text-amber-900'
  if (s === 'out_for_delivery') return 'bg-violet-100 text-violet-800'
  return 'bg-gray-100 text-gray-700'
}

async function loadDetailOrderStatus() {
  if (!selectedOrderId.value) return
  detailErrorMessage.value = ''
  try {
    const res = await fetch(
      `/api/client-order-status?orderId=${encodeURIComponent(selectedOrderId.value)}`,
      {
        method: 'GET',
        headers: requestHeaders(),
      },
    )
    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as any
      throw new Error(errJson?.statusMessage || errJson?.message || 'Не удалось загрузить статус заказа')
    }
    const json = (await res.json()) as { ok: boolean; order?: ClientOrderStatusDetail }
    if (!json?.ok || !json.order) {
      throw new Error('Некорректный ответ сервера')
    }
    detailOrder.value = json.order
    const st = (json.order.status || '').toLowerCase()
    if (st === 'cancelled' || st === 'handed_to_customer' || st === 'done') {
      if (detailPollHandle != null) {
        window.clearInterval(detailPollHandle)
        detailPollHandle = null
      }
    }
  } catch (e: any) {
    detailErrorMessage.value = e?.message || 'Не удалось загрузить статус заказа'
  }
}

onMounted(async () => {
  pending.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/client-orders', {
      method: 'GET',
      headers: requestHeaders(),
    })
    if (!res.ok) {
      throw new Error('Не удалось загрузить заказы')
    }
    const json = await res.json() as { ok: boolean; items: ClientOrder[] }
    data.value = json ?? { ok: true, items: [] }
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || error?.message || 'Не удалось загрузить заказы'
  } finally {
    pending.value = false
  }

  // Детальный экран статуса (если пришли с query `orderId`)
  if (selectedOrderId.value) {
    await loadDetailOrderStatus()
    detailPollHandle = window.setInterval(loadDetailOrderStatus, 3000)
  }
})

onBeforeUnmount(() => {
  if (detailPollHandle != null) {
    window.clearInterval(detailPollHandle)
    detailPollHandle = null
  }
})

watch(selectedOrderId, async (nextId: string) => {
  if (detailPollHandle != null) {
    window.clearInterval(detailPollHandle)
    detailPollHandle = null
  }
  if (!nextId) return
  await loadDetailOrderStatus()
  detailPollHandle = window.setInterval(loadDetailOrderStatus, 3000)
})

function statusLabel(status: string) {
  const map: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    ready_for_pickup: 'На выдаче',
    out_for_delivery: 'Доставка',
    handed_to_customer: 'Выдан',
    done: 'Выдан',
    cancelled: 'Отменен',
  }
  return map[status] || status
}

function paymentLabel(method: string) {
  if (method === 'card_courier') return 'Картой курьеру'
  if (method === 'online') return 'Онлайн'
  return 'Наличными'
}

function fulfillmentLabel(type: string) {
  if (type === 'pickup') return 'Самовывоз'
  if (type === 'qr-menu') return 'В ресторане'
  return 'Доставка'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatAt(iso: string) {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

const normalizedOrders = computed<NormalizedOrder[]>(() => (data.value?.items || []).map((order: ClientOrder) => ({
  ...order,
  statusText: statusLabel(order.status),
  paymentText: paymentLabel(order.paymentMethod),
  fulfillmentText: fulfillmentLabel(order.fulfillmentType),
  createdAtText: formatDate(order.createdAt),
  totalText: formatPrice(order.total),
})))

const filteredOrders = computed(() => {
  const q = query.value.toLowerCase()
  let list = normalizedOrders.value.filter((order: NormalizedOrder) => order.restaurantName.toLowerCase().includes(q))

  if (statusFilter.value === 'active') {
    list = list.filter((order: NormalizedOrder) => order.isActive)
  } else if (statusFilter.value === 'history') {
    list = list.filter((order: NormalizedOrder) => !order.isActive)
  }

  if (sortBy.value === 'oldest') {
    list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } else if (sortBy.value === 'amount') {
    list = [...list].sort((a, b) => b.total - a.total)
  } else {
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  return list
})

const activeOrders = computed(() => normalizedOrders.value.filter((order: NormalizedOrder) => order.isActive))

const OrderCard = defineComponent({
  props: {
    order: {
      type: Object as PropType<(typeof normalizedOrders.value)[number]>,
      required: true,
    },
  },
  setup(props: { order: NormalizedOrder }) {
    return () => h('div', { class: 'space-y-2 text-sm text-gray-700' }, [
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2' }, [
        h('p', { class: 'font-semibold text-gray-900' }, props.order.restaurantName),
        h('span', {
          class: [
            'rounded-full px-2.5 py-1 text-xs font-medium',
            props.order.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700',
          ],
        }, props.order.statusText),
      ]),
      h('div', { class: 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600' }, [
        h('span', `Заказ: #${props.order.id.slice(0, 8)}`),
        h('span', props.order.createdAtText),
        h('span', props.order.fulfillmentText),
        h('span', props.order.paymentText),
      ]),
      h('div', { class: 'flex items-center justify-between pt-1' }, [
        h('span', { class: 'text-xs text-gray-600' }, `Позиций: ${props.order.itemsCount}`),
        h('span', { class: 'font-semibold text-primary' }, props.order.totalText),
      ]),
      ...(Array.isArray(props.order.itemsPreview) && props.order.itemsPreview.length
        ? [
            h('div', { class: 'pt-1' }, [
              h('p', { class: 'text-xs font-medium text-gray-700' }, 'Состав:'),
              h(
                'p',
                { class: 'text-xs text-gray-600' },
                props.order.itemsPreview
                  .map((item: { name: string; quantity: number }) => `${item.name} × ${item.quantity}`)
                  .join(', '),
              ),
            ]),
          ]
        : []),
    ])
  },
})
</script>
