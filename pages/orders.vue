<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Мои заказы</h1>
      <p class="mt-1 text-sm text-gray-600">
        История заказов по разным ресторанам, с выделением активных.
      </p>
    </header>

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
import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue'

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
  createdAt: string
}

const query = ref('')
const statusFilter = ref<'all' | 'active' | 'history'>('all')
const sortBy = ref<'newest' | 'oldest' | 'amount'>('newest')

const pending = ref(true)
const errorMessage = ref('')
const data = ref<{ ok: boolean; items: ClientOrder[] }>({ ok: true, items: [] })

onMounted(async () => {
  pending.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/client-orders', { method: 'GET' })
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
})

function statusLabel(status: string) {
  const map: Record<string, string> = {
    new: 'Новый',
    in_progress: 'В работе',
    done: 'Завершен',
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
  return type === 'pickup' ? 'Самовывоз' : 'Доставка'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

const normalizedOrders = computed(() => (data.value?.items || []).map((order) => ({
  ...order,
  statusText: statusLabel(order.status),
  paymentText: paymentLabel(order.paymentMethod),
  fulfillmentText: fulfillmentLabel(order.fulfillmentType),
  createdAtText: formatDate(order.createdAt),
  totalText: formatPrice(order.total),
})))

const filteredOrders = computed(() => {
  const q = query.value.toLowerCase()
  let list = normalizedOrders.value.filter((order) => order.restaurantName.toLowerCase().includes(q))

  if (statusFilter.value === 'active') {
    list = list.filter((order) => order.isActive)
  } else if (statusFilter.value === 'history') {
    list = list.filter((order) => !order.isActive)
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

const activeOrders = computed(() => normalizedOrders.value.filter((order) => order.isActive))

const OrderCard = defineComponent({
  props: {
    order: {
      type: Object as PropType<(typeof normalizedOrders.value)[number]>,
      required: true,
    },
  },
  setup(props) {
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
    ])
  },
})
</script>
