<template>
  <section v-if="order" class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Заказ {{ order.id }}</h1>
        <p class="mt-1 text-sm text-gray-600">{{ order.customerName }} · {{ order.phone }}</p>
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
        <p class="mt-1 text-lg font-semibold">{{ order.branch }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase text-gray-500">Город</p>
        <p class="mt-1 text-lg font-semibold">{{ order.city }}</p>
      </div>
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
        <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="applyStatus">
          Применить
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Таймлайн</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(item, idx) in localTimeline" :key="`${item.at}-${idx}`" class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
          <span>{{ item.label }}</span>
          <span class="text-gray-500">{{ item.at }}</span>
        </li>
      </ul>
    </div>
  </section>
  <section v-else>
    <h1 class="text-2xl font-semibold">Заказ не найден</h1>
    <p class="mt-2 text-sm text-gray-600">Проверьте ссылку или вернитесь к списку заказов.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { allowedStatusTransitions, dashboardOrders, type DashboardOrderStatus } from '~/data/dashboardMock'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const { can } = useDashboardAccess()
const order = ref(dashboardOrders.find((item) => item.id === String(route.params.id)))
const errorMessage = ref<string | null>(null)
const comment = ref('')
const nextStatus = ref<DashboardOrderStatus>('confirmed')

const localTimeline = ref(order.value ? [...order.value.timeline] : [])

const allowedTransitions = computed(() => {
  if (!order.value) return []
  return allowedStatusTransitions[order.value.status]
})

if (allowedTransitions.value.length) {
  nextStatus.value = allowedTransitions.value[0]
}

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

function nowLabel() {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function applyStatus() {
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
  order.value.status = nextStatus.value
  localTimeline.value.unshift({
    at: nowLabel(),
    label: `Статус изменен на "${statusLabel(nextStatus.value)}"${comment.value.trim() ? `: ${comment.value.trim()}` : ''}`,
  })
  comment.value = ''
  nextStatus.value = allowedStatusTransitions[order.value.status][0] || order.value.status
}
</script>
