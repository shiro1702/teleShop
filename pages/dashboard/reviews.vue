<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Отзывы</h1>
        <p class="mt-1 text-sm text-gray-600">
          Очередь негатива, модерация и метрики репутации (модуль <code class="rounded bg-gray-100 px-1">reputation_reviews_pro</code>).
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        @click="loadQueue"
      >
        Обновить
      </button>
    </div>

    <div v-if="featureBlocked" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Модуль отзывов выключен или не выполнены зависимости (<code class="rounded bg-white/80 px-1">crm_orders_db</code>,
      <code class="rounded bg-white/80 px-1">core_telegram_orders</code>).
      Включите подписку в разделе интеграций / биллинга или через API <code class="rounded bg-white/80 px-1">/api/dashboard/features/toggle</code>.
    </div>

    <div v-else class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Публичный рейтинг</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ metrics.public_rating ?? '—' }}</p>
        <p class="mt-1 text-xs text-gray-500">Выборка: {{ metrics.public_sample_count }} · только опубликованные</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Внутр. качество</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ metrics.internal_quality_score ?? '—' }}</p>
        <p class="mt-1 text-xs text-gray-500">Выборка: {{ metrics.internal_sample_count }} · все статусы</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Негатив (1–3★)</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{{ metrics.negative_total }}</p>
        <p class="mt-1 text-xs text-gray-500">Решено: {{ metrics.negative_resolved }} ({{ metrics.negative_resolved_percent }}%)</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Формула публичного рейтинга</p>
        <p class="mt-1 text-sm text-gray-700">По последним 20 опубликованным отзывам (среднее звёзд).</p>
      </div>
    </div>

    <div v-if="!featureBlocked" class="grid gap-2 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Статус</span>
        <select v-model="statusFilter" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="all">Все</option>
          <option value="new">Новые</option>
          <option value="manager_review">На менеджере</option>
          <option value="published">Опубликовано</option>
          <option value="rejected">Отклонено</option>
          <option value="resolved">Решено</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Только негатив (≤3)</span>
        <select v-model="onlyNegative" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="0">Нет</option>
          <option value="1">Да</option>
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Филиал (UUID)</span>
        <input
          v-model.trim="restaurantFilter"
          type="text"
          placeholder="опционально"
          class="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
      </label>
    </div>

    <div class="fixed right-4 top-20 z-[100] space-y-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg"
        :class="toast.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'"
      >
        <p>{{ toast.message }}</p>
        <button type="button" class="ml-1 text-xs" @click="dismissToast(toast.id)">×</button>
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Загрузка…
    </div>
    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>
    <div v-else-if="!featureBlocked && !items.length" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Нет отзывов по фильтрам.
    </div>
    <div v-else-if="!featureBlocked" class="space-y-3">
      <article v-for="item in items" :key="item.id" class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900">{{ item.restaurantName }}</p>
            <p class="text-xs text-gray-500">
              Заказ {{ item.orderId.slice(0, 8) }} · {{ formatTs(item.createdAt) }} · {{ item.rating }}★
            </p>
            <p class="mt-1 text-xs text-gray-600">Статус: <span class="font-medium">{{ item.status }}</span></p>
            <p v-if="item.comment" class="mt-2 text-sm text-gray-800">{{ item.comment }}</p>
          </div>
          <span class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{{ item.id.slice(0, 8) }}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            :disabled="actionBusy === item.id"
            @click="runAction(item.id, 'publish')"
          >
            Опубликовать
          </button>
          <button
            type="button"
            class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            :disabled="actionBusy === item.id"
            @click="runAction(item.id, 'reject')"
          >
            Отклонить
          </button>
          <button
            type="button"
            class="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
            :disabled="actionBusy === item.id"
            @click="runAction(item.id, 'resolve')"
          >
            Решено
          </button>
          <button
            type="button"
            class="rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            :disabled="actionBusy === item.id"
            @click="runAction(item.id, 'reopen')"
          >
            Вернуть в работу
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

definePageMeta({ layout: 'dashboard' })

type Row = {
  id: string
  restaurantId: string | null
  restaurantName: string
  orderId: string
  rating: number
  comment: string | null
  videoUrl: string | null
  status: string
  moderationChannel: string | null
  moderationChatId: string | null
  forwardedToManagerAt: string | null
  publishedAt: string | null
  resolvedAt: string | null
  createdAt: string
}

type Metrics = {
  public_rating: number | null
  public_sample_count: number
  internal_quality_score: number | null
  internal_sample_count: number
  negative_total: number
  negative_resolved: number
  negative_resolved_percent: number
}

const pending = ref(false)
const errorMessage = ref('')
const featureBlocked = ref(false)
const items = ref<Row[]>([])
const metrics = ref<Metrics>({
  public_rating: null,
  public_sample_count: 0,
  internal_quality_score: null,
  internal_sample_count: 0,
  negative_total: 0,
  negative_resolved: 0,
  negative_resolved_percent: 0,
})

const statusFilter = ref('all')
const onlyNegative = ref('0')
const restaurantFilter = ref('')
const actionBusy = ref('')
const toasts = ref<Array<{ id: string; type: 'ok' | 'error'; message: string }>>([])

function pushToast(type: 'ok' | 'error', message: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toasts.value = [...toasts.value, { id, type, message }]
  setTimeout(() => dismissToast(id), type === 'error' ? 9000 : 5000)
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((t: { id: string }) => t.id !== id)
}

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

async function loadQueue() {
  pending.value = true
  errorMessage.value = ''
  featureBlocked.value = false
  try {
    const q = new URLSearchParams()
    if (statusFilter.value !== 'all') q.set('status', statusFilter.value)
    if (onlyNegative.value === '1') q.set('only_negative', '1')
    if (restaurantFilter.value) q.set('restaurant_id', restaurantFilter.value)
    q.set('limit', '120')
    const response = await fetch(`/api/dashboard/reviews?${q.toString()}`)
    const payload = await response.json().catch(() => ({} as Record<string, unknown>))
    if (response.status === 402 || response.status === 403 || response.status === 404) {
      featureBlocked.value = true
      items.value = []
      return
    }
    if (!response.ok) {
      const msg = typeof payload.statusMessage === 'string' ? payload.statusMessage : 'Не удалось загрузить отзывы'
      throw new Error(msg)
    }
    items.value = Array.isArray(payload.items) ? (payload.items as Row[]) : []
    const m = payload.metrics as Metrics | undefined
    if (m) metrics.value = m
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Ошибка загрузки'
  } finally {
    pending.value = false
  }
}

async function runAction(reviewId: string, action: 'publish' | 'reject' | 'resolve' | 'reopen') {
  actionBusy.value = reviewId
  try {
    const response = await fetch('/api/dashboard/reviews/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, action }),
    })
    const payload = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
      throw new Error(typeof payload.statusMessage === 'string' ? payload.statusMessage : 'Действие не выполнено')
    }
    pushToast('ok', 'Сохранено')
    await loadQueue()
  } catch (err: unknown) {
    pushToast('error', err instanceof Error ? err.message : 'Ошибка')
  } finally {
    actionBusy.value = ''
  }
}

onMounted(() => {
  void loadQueue()
})

watch([statusFilter, onlyNegative, restaurantFilter], () => {
  void loadQueue()
})
</script>
