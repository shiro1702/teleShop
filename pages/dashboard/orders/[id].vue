<template>
  <section v-if="loadError" class="space-y-4">
    <h1 class="text-2xl font-semibold">Ошибка</h1>
    <p class="text-sm text-red-700">{{ loadError }}</p>
    <NuxtLink to="/dashboard/orders" class="text-primary text-sm hover:underline">К списку заказов</NuxtLink>
  </section>

  <section v-else-if="pending" class="space-y-4">
    <p class="text-sm text-gray-600">Загрузка заказа…</p>
  </section>

  <section v-else-if="order" class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Заказ {{ shortId(order.id) }}</h1>
        <p class="mt-1 text-sm text-gray-600">
          {{
            order.customerTelegramId != null
              ? `Telegram ${order.customerTelegramId}`
              : order.customerProfileId
                ? `Профиль ${shortId(order.customerProfileId)}`
                : 'Клиент'
          }}
        </p>
      </div>
      <span class="rounded-full px-2 py-1 text-xs" :class="statusClass(order.status)">
        {{ statusLabel(order.status) }}
      </span>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase text-gray-500">Сумма</p>
        <p class="mt-1 text-lg font-semibold">{{ order.total }} ₽</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase text-gray-500">Филиал</p>
        <p class="mt-1 text-lg font-semibold">{{ order.restaurantName }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase text-gray-500">Город</p>
        <p class="mt-1 text-lg font-semibold">{{ order.cityName }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Состав</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(it, idx) in order.items" :key="idx" class="flex justify-between gap-2 border-b border-gray-100 pb-2">
          <span>{{ it.name }} × {{ it.quantity }}</span>
          <span class="text-gray-600">{{ it.price * it.quantity }} ₽</span>
        </li>
      </ul>
      <p v-if="!order.items.length" class="mt-2 text-sm text-gray-500">Позиции не указаны</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Смена статуса</h2>
      <div v-if="!can('orders.status.change')" class="mt-2 text-sm text-red-700">Недостаточно прав.</div>
      <div v-else class="mt-3 space-y-3">
        <label class="block text-sm">
          <span class="mb-1 block text-gray-600">Новый статус</span>
          <select v-model="nextStatus" class="w-full rounded-lg border border-gray-300 px-2 py-2">
            <option v-for="value in allowedTransitions" :key="value" :value="value">{{ statusLabel(value) }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-gray-600">Комментарий (обязателен для отмены)</span>
          <textarea v-model="comment" rows="3" class="w-full rounded-lg border border-gray-300 px-2 py-2" />
        </label>
        <p v-if="errorMessage" class="text-sm text-red-700">{{ errorMessage }}</p>
        <button
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          :disabled="saving || !allowedTransitions.length"
          @click="applyStatus"
        >
          {{ saving ? 'Сохранение…' : 'Применить' }}
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Таймлайн</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li
          v-for="(item, idx) in order.timeline"
          :key="`${item.at}-${idx}`"
          class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2"
        >
          <span>{{ item.label }}</span>
          <span class="shrink-0 text-gray-500">{{ formatAt(item.at) }}</span>
        </li>
      </ul>
      <p v-if="!order.timeline.length" class="mt-2 text-sm text-gray-500">Событий пока нет</p>
    </div>
  </section>

  <section v-else>
    <h1 class="text-2xl font-semibold">Заказ не найден</h1>
    <p class="mt-2 text-sm text-gray-600">Проверьте ссылку или вернитесь к списку заказов.</p>
    <NuxtLink to="/dashboard/orders" class="mt-2 inline-block text-primary text-sm hover:underline">К списку</NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const { can } = useDashboardAccess()

type DashboardOrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'

type OrderItem = {
  productId: string
  name: string
  quantity: number
  price: number
}

type TimelineEntry = { at: string; label: string }

type OrderDetail = {
  id: string
  restaurantName: string
  cityName: string
  status: DashboardOrderStatus
  total: number
  items: OrderItem[]
  timeline: TimelineEntry[]
  customerTelegramId: number | null
  customerProfileId: string | null
}

const transitions: Record<DashboardOrderStatus, DashboardOrderStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
}

const orderId = computed(() => String(route.params.id || ''))

const order = ref<OrderDetail | null>(null)
const pending = ref(true)
const loadError = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const comment = ref('')
const nextStatus = ref<DashboardOrderStatus>('in_progress')
const saving = ref(false)

const allowedTransitions = computed(() => {
  if (!order.value) return []
  return transitions[order.value.status] ?? []
})

watch(allowedTransitions, (list) => {
  if (list.length) nextStatus.value = list[0]
})

async function loadOrder() {
  pending.value = true
  loadError.value = null
  order.value = null
  try {
    const res = await fetch(`/api/dashboard/orders/${orderId.value}`)
    const data = await res.json() as { ok?: boolean; order?: OrderDetail; statusMessage?: string }
    if (!res.ok) {
      if (res.status === 404) {
        pending.value = false
        return
      }
      throw new Error(data.statusMessage || 'Не удалось загрузить заказ')
    }
    if (data.ok && data.order) {
      order.value = data.order
    }
  } catch (e: any) {
    loadError.value = e?.message || 'Ошибка загрузки'
  } finally {
    pending.value = false
  }
}

onMounted(loadOrder)

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

function formatAt(iso: string) {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
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

async function applyStatus() {
  errorMessage.value = null
  if (!order.value) return
  if (!allowedTransitions.value.includes(nextStatus.value)) {
    errorMessage.value = 'Недопустимый переход статуса.'
    return
  }
  if (nextStatus.value === 'cancelled' && !comment.value.trim()) {
    errorMessage.value = 'Для отмены заказа нужен комментарий.'
    return
  }
  saving.value = true
  try {
    const res = await fetch(`/api/dashboard/orders/${order.value.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextStatus: nextStatus.value, comment: comment.value.trim() || undefined }),
    })
    const data = await res.json() as { ok?: boolean; statusMessage?: string }
    if (!res.ok) {
      throw new Error(data.statusMessage || 'Не удалось обновить статус')
    }
    comment.value = ''
    await loadOrder()
  } catch (e: any) {
    errorMessage.value = e?.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}
</script>
