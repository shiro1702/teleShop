<template>
  <div class="min-h-screen" :style="pageStyle">
    <div class="pointer-events-none fixed inset-x-0 top-20 z-[95] mx-auto flex w-full max-w-md flex-col gap-2 px-4">
      <TransitionGroup name="toast">
        <div
          v-for="toast in serviceCallToasts"
          :key="toast.id"
          class="pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg"
          :class="toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'"
        >
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>

    <header class="border-b" :style="headerStyle">
      <div class="mx-auto grid max-w-6xl grid-cols-3 items-center gap-3 px-4 py-4 sm:px-6">
        <div class="flex w-24 items-center sm:w-32">
          <NuxtLink
            :to="tenantPath('/')"
            class="flex w-fit items-center gap-2 transition"
            :style="{ color: mutedTextColor }"
            aria-label="Назад к меню"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span class="hidden text-sm sm:inline">Меню</span>
          </NuxtLink>
        </div>

        <h1 class="text-center text-xl font-bold" :style="{ color: mainTextColor }">
          Мои заказы
        </h1>
        <div />
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div class="mb-6">
        <p class="text-sm" :style="{ color: mutedTextColor }">
          {{ isTenantOrdersPage ? 'История заказов в этом ресторане.' : 'История заказов по разным ресторанам, с выделением активных.' }}
        </p>
        <p v-if="isTenantOrdersPage && cityOrdersPath" class="mt-2 text-sm">
          <NuxtLink
            :to="cityOrdersPath"
            class="font-medium underline decoration-dotted underline-offset-2"
            :style="{ color: mainTextColor }"
          >
            Перейти ко всем заказам по городу
          </NuxtLink>
        </p>
      </div>

    <section v-if="festivalSlug" class="mb-6 rounded-xl border border-primary-100 bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900">Фестиваль: видеоотзывы и Live-сторис</h2>
          <p class="mt-1 text-xs text-gray-600">Публикация доступна после реального заказа. Сначала контент попадет на модерацию.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" :disabled="ugcLoading" @click="loadFestivalEligibility">
            Обновить доступ
          </button>
          <button class="rounded-lg border border-primary-300 px-3 py-1.5 text-sm text-primary hover:bg-primary-50 disabled:opacity-50" :disabled="ugcLoading || !ugcEligibility.canPostStory" @click="openUgcComposer('story')">
            Добавить Live-сторис
          </button>
          <button class="rounded-lg border border-primary-300 px-3 py-1.5 text-sm text-primary hover:bg-primary-50 disabled:opacity-50" :disabled="ugcLoading || !ugcEligibility.canPostReview" @click="openUgcComposer('video_review')">
            Добавить видеоотзыв
          </button>
        </div>
      </div>
      <p v-if="ugcMessage" class="mt-2 text-sm" :class="ugcMessageType === 'ok' ? 'text-emerald-700' : 'text-red-700'">
        {{ ugcMessage }}
      </p>
    </section>

    <section v-if="festivalSlug && ugcComposerOpen" class="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-gray-900">
        {{ ugcKind === 'story' ? 'Новая Live-сторис' : 'Новый видеоотзыв' }}
      </h3>
      <div class="mt-3 grid gap-2 md:grid-cols-2">
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Видео/фото</span>
          <input type="file" accept="video/*,image/*" class="w-full rounded-lg border border-gray-300 px-3 py-2" @change="onUgcFileSelected">
        </label>
        <label v-if="ugcKind === 'video_review'" class="text-sm">
          <span class="mb-1 block text-gray-600">Оценка</span>
          <select v-model.number="ugcRating" class="w-full rounded-lg border border-gray-300 px-3 py-2">
            <option :value="5">5</option>
            <option :value="4">4</option>
            <option :value="3">3</option>
            <option :value="2">2</option>
            <option :value="1">1</option>
          </select>
        </label>
      </div>
      <label class="mt-2 block text-sm">
        <span class="mb-1 block text-gray-600">Категория</span>
        <select v-model="ugcCategory" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="live">Live</option>
          <option value="food">Еда</option>
          <option value="stage">Сцена</option>
          <option value="vibe">Вайб</option>
          <option value="quest">Квест</option>
        </select>
      </label>
      <label v-if="ugcKind === 'video_review'" class="mt-2 block text-sm">
        <span class="mb-1 block text-gray-600">Заказ для отзыва</span>
        <select v-model="ugcOrderId" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option v-for="item in ugcEligibility.ordersForReview" :key="item.id" :value="item.id">
            {{ item.restaurantName }} • {{ item.orderNumber }}
          </option>
        </select>
      </label>
      <label class="mt-3 flex items-start gap-2 text-xs text-gray-600">
        <input v-model="ugcConsentChecked" type="checkbox">
        Даю согласие на публикацию моего видео/аудио в фестивальной ленте и меню после модерации.
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded-lg border border-primary-300 px-3 py-1.5 text-sm text-primary hover:bg-primary-50 disabled:opacity-50" :disabled="ugcSubmitting || !ugcConsentChecked || !ugcFile" @click="submitFestivalUgc">
          Отправить на модерацию
        </button>
        <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" :disabled="ugcSubmitting" @click="ugcComposerOpen = false">
          Закрыть
        </button>
      </div>
    </section>

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
        <div v-if="showOrderHallService" class="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <h3 class="text-sm font-semibold text-gray-900">Сервис в зале</h3>
          <p class="mt-1 text-xs text-gray-600">Можно отправить запрос персоналу прямо из заказа.</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button class="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-50" :disabled="serviceCallSubmitting" @click="createServiceCall('call_waiter')">
              Позвать официанта
            </button>
            <button class="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-50" :disabled="serviceCallSubmitting" @click="createServiceCall('call_hookah')">
              Позвать кальянщика
            </button>
            <button class="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-50" :disabled="serviceCallSubmitting" @click="createServiceCall('request_bill')">
              Выставить счет
            </button>
          </div>
          <p v-if="serviceCallMessage" class="mt-2 text-xs" :class="serviceCallMessageType === 'ok' ? 'text-emerald-700' : 'text-red-700'">
            {{ serviceCallMessage }}
          </p>
          <ul v-if="serviceCalls.length" class="mt-2 space-y-1 text-xs text-gray-700">
            <li v-for="item in serviceCalls" :key="item.id" class="rounded border border-gray-200 bg-white px-2 py-1">
              {{ serviceCallTypeLabel(item.callType) }} — {{ serviceCallStatusLabel(item.status) }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <div
      v-if="pending"
      class="rounded-xl border p-4"
      :style="cardStyle"
      aria-hidden="true"
    >
      <div class="animate-pulse space-y-3">
        <div class="h-4 w-40 rounded" :style="skeletonBlockStyle" />
        <div class="h-16 w-full rounded-xl" :style="skeletonBlockStyle" />
        <div class="h-16 w-full rounded-xl" :style="skeletonBlockStyle" />
        <div class="h-16 w-full rounded-xl" :style="skeletonBlockStyle" />
      </div>
    </div>

    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <template v-else>
      <section class="mb-4 rounded-xl border p-4" :style="cardStyle">
        <div class="grid grid-cols-1 gap-3" :class="isTenantOrdersPage ? 'sm:grid-cols-2' : 'sm:grid-cols-3'">
          <label v-if="!isTenantOrdersPage" class="text-sm">
            <span class="mb-1 block" :style="{ color: mutedTextColor }">Поиск ресторана</span>
            <input
              v-model.trim="query"
              type="text"
              placeholder="Например: Суши"
              class="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1"
              :style="inputStyle"
            >
          </label>

          <label class="text-sm">
            <span class="mb-1 block" :style="{ color: mutedTextColor }">Статус</span>
            <select
              v-model="statusFilter"
              class="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1"
              :style="inputStyle"
            >
              <option value="all">Все</option>
              <option value="active">Только активные</option>
              <option value="history">Только завершенные</option>
            </select>
          </label>

          <label class="text-sm">
            <span class="mb-1 block" :style="{ color: mutedTextColor }">Сортировка</span>
            <select
              v-model="sortBy"
              class="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1"
              :style="inputStyle"
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="amount">По сумме</option>
            </select>
          </label>
        </div>
      </section>

      <section
        v-if="reviewsFlagsLoaded && eligibleReviewOrders.length"
        class="mb-4 rounded-xl border p-4"
        :style="cardStyle"
      >
        <h2 class="mb-2 text-lg font-semibold" :style="{ color: mainTextColor }">Оцените заказ</h2>
        <p class="text-sm" :style="{ color: mutedTextColor }">Короткая оценка помогает ресторану и другим гостям.</p>
        <ul class="mt-3 space-y-2">
          <li
            v-for="order in eligibleReviewOrders"
            :key="order.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            <div>
              <p class="text-sm font-medium text-gray-900">{{ order.restaurantName }}</p>
              <p class="text-xs text-gray-500">#{{ order.id.slice(0, 8) }} · {{ order.createdAtText }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
              @click="openReviewModal(order)"
            >
              Оценить
            </button>
          </li>
        </ul>
      </section>

      <section v-if="activeOrders.length" class="mb-6">
        <h2 class="mb-3 text-lg font-semibold" :style="{ color: mainTextColor }">Активные заказы</h2>
        <ul class="space-y-3">
          <li
            v-for="order in activeOrders"
            :key="order.id"
            class="rounded-xl border p-4"
            :style="activeOrderCardStyle"
          >
            <OrderCard :order="order" />
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold" :style="{ color: mainTextColor }">Все заказы</h2>
        <div v-if="!filteredOrders.length" class="rounded-xl border p-4 text-sm" :style="cardStyle">
          По выбранным фильтрам заказов не найдено.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="order in filteredOrders"
            :key="order.id"
            class="rounded-xl border p-4"
            :style="orderCardStyle"
          >
            <OrderCard :order="order" />
          </li>
        </ul>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="reviewModalOpen"
        class="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        @click.self="closeReviewModal"
      >
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900">Ваш отзыв</h3>
          <p class="mt-1 text-sm text-gray-600">Оценка и комментарий привязаны к заказу.</p>
          <label class="mt-3 block text-sm text-gray-700">Оценка
            <select v-model.number="reviewRating" class="mt-1 w-full rounded border border-gray-300 px-2 py-2">
              <option v-for="n in 5" :key="n" :value="n">{{ n }} из 5</option>
            </select>
          </label>
          <label class="mt-3 block text-sm text-gray-700">Комментарий (необязательно)
            <textarea v-model="reviewComment" rows="3" class="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm" />
          </label>
          <p v-if="reviewError" class="mt-2 text-sm text-red-600">{{ reviewError }}</p>
          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm" @click="closeReviewModal">Отмена</button>
            <button
              type="button"
              class="rounded-lg bg-primary px-3 py-2 text-sm text-on-primary disabled:opacity-50"
              :disabled="reviewSubmitting"
              @click="submitShopReview"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useRoute } from 'vue-router'
import { useTenant } from '~/composables/useTenant'
import { useTelegram } from '~/composables/useTelegram'
import { isHallOrderFulfillmentType } from '~/utils/fulfillmentPreference'

type ClientOrder = {
  id: string
  shopId?: string
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
  hasShopReview?: boolean
}
type FestivalEligibilityOrder = {
  id: string
  orderNumber: string
  restaurantName: string
}

const query = ref('')
const statusFilter = ref<'all' | 'active' | 'history'>('all')
const sortBy = ref<'newest' | 'oldest' | 'amount'>('newest')

const REVIEW_ORDER_IDS_KEY = 'teleShop_review_order_ids'

const reviewsFlagsLoaded = ref(false)
/** Whether `reputation_reviews_pro` is on for a given shop (from GET /api/reviews). */
const shopReviewModuleEnabled = ref<Record<string, boolean>>({})
const reviewedOrderIds = ref<string[]>([])
const reviewModalOpen = ref(false)
const reviewShopId = ref('')
const reviewOrderId = ref('')
const reviewRating = ref(5)
const reviewComment = ref('')
const reviewSubmitting = ref(false)
const reviewError = ref('')

const pending = ref(true)
const errorMessage = ref('')
const data = ref<{ ok: boolean; items: ClientOrder[] }>({ ok: true, items: [] })

const route = useRoute()
const { tenant, tenantKey, tenantPath } = useTenant()
const { buildMessengerAuthHeaders, isMessengerMiniApp, messengerInitData } = useTelegram()

const isTenantOrdersPage = computed(() => !!(tenantKey.value && tenantKey.value.trim()))
const cityOrdersPath = computed(() => {
  const city = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  if (!city) return ''
  return `/${city}/orders`
})

const primaryShopId = computed(() => {
  const t = typeof tenantKey.value === 'string' ? tenantKey.value.trim() : ''
  if (t) return t
  const withShop = data.value.items.find((x: ClientOrder) => x.shopId)
  return typeof withShop?.shopId === 'string' ? withShop.shopId : ''
})

function loadReviewedOrderIdsFromStorage() {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(REVIEW_ORDER_IDS_KEY)
    const parsed = JSON.parse(raw || '[]')
    reviewedOrderIds.value = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    reviewedOrderIds.value = []
  }
}

function markReviewSubmitted(orderId: string) {
  if (reviewedOrderIds.value.includes(orderId)) return
  reviewedOrderIds.value = [...reviewedOrderIds.value, orderId]
  if (import.meta.client) {
    localStorage.setItem(REVIEW_ORDER_IDS_KEY, JSON.stringify(reviewedOrderIds.value))
  }
}

function orderCompletedForReview(status: string) {
  return (status || '').toLowerCase() === 'handed_to_customer'
}

async function loadReviewModuleFlagsForOrders() {
  reviewsFlagsLoaded.value = false
  const ids = Array.from(
    new Set(
      (data.value?.items || [])
        .map((o: ClientOrder) => o.shopId)
        .filter((x): x is string => typeof x === 'string' && !!x.trim()),
    ),
  )
  if (!ids.length) {
    reviewsFlagsLoaded.value = true
    return
  }
  const next: Record<string, boolean> = { ...shopReviewModuleEnabled.value }
  await Promise.all(
    ids.map(async (shopId: string) => {
      if (next[shopId] !== undefined) return
      try {
        const res = await fetch(`/api/reviews?shop_id=${encodeURIComponent(shopId)}&limit=1`)
        const payload = await res.json().catch(() => ({} as any))
        next[shopId] = payload?.moduleEnabled === true
      } catch {
        next[shopId] = false
      }
    }),
  )
  shopReviewModuleEnabled.value = next
  reviewsFlagsLoaded.value = true
}

function openReviewModal(order: ClientOrder) {
  const sid = (typeof order.shopId === 'string' && order.shopId.trim()) || primaryShopId.value
  if (!sid) {
    reviewError.value = 'Не удалось определить заведение для отзыва'
    return
  }
  reviewShopId.value = sid
  reviewOrderId.value = order.id
  reviewRating.value = 5
  reviewComment.value = ''
  reviewError.value = ''
  reviewModalOpen.value = true
}

function closeReviewModal() {
  reviewModalOpen.value = false
}

async function submitShopReview() {
  reviewSubmitting.value = true
  reviewError.value = ''
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestHeaders(),
    }
    if (reviewShopId.value) headers['x-shop-id'] = reviewShopId.value
    let res = await fetch('/api/reviews', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: reviewOrderId.value,
        rating: reviewRating.value,
        comment: reviewComment.value.trim() || null,
        videoUrl: null,
      }),
    })
    if (res.status === 409) {
      res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          orderId: reviewOrderId.value,
          rating: reviewRating.value,
        }),
      })
    }
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      throw new Error(payload?.statusMessage || payload?.message || 'Не удалось отправить отзыв')
    }
    markReviewSubmitted(reviewOrderId.value)
    closeReviewModal()
    try {
      data.value = await fetchOrders()
    } catch {
      /* ignore refresh errors */
    }
  } catch (e: unknown) {
    reviewError.value = e instanceof Error ? e.message : 'Ошибка'
  } finally {
    reviewSubmitting.value = false
  }
}

const theme = computed(() => tenant.value.theme || {})
const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')
const inputBgColor = computed(() => theme.value.surface_input || cardBgColor.value)
const inputBorderColor = computed(() => theme.value.surface_input_border || borderColor.value)
const activeBgColor = computed(() => theme.value.primary_50 || '#ecfdf5')
const activeBorderColor = computed(() => theme.value.primary_200 || '#a7f3d0')

const pageStyle = computed(() => ({
  backgroundColor: pageBgColor.value,
  color: mainTextColor.value,
}))

const headerStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: cardBgColor.value,
}))

const cardStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: cardBgColor.value,
  color: mainTextColor.value,
}))

const activeCardStyle = computed(() => ({
  borderColor: activeBorderColor.value,
  backgroundColor: activeBgColor.value,
}))

const orderCardStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: '#ffffff',
}))

const activeOrderCardStyle = computed(() => ({
  borderColor: activeBorderColor.value,
  backgroundColor: '#ffffff',
}))

const inputStyle = computed(() => ({
  borderColor: inputBorderColor.value,
  backgroundColor: inputBgColor.value,
  color: mainTextColor.value,
  '--tw-ring-color': borderColor.value,
} as Record<string, string>))

const skeletonBlockStyle = computed(() => ({
  backgroundColor: borderColor.value,
  opacity: 0.7,
}))

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

const activeOrderStatuses = new Set(['new', 'in_progress', 'ready_for_pickup', 'out_for_delivery'])

const detailErrorMessage = ref('')
const detailOrder = ref<ClientOrderStatusDetail | null>(null)
const showOrderHallService = computed(() =>
  detailOrder.value != null && isHallOrderFulfillmentType(detailOrder.value.fulfillmentType),
)
const serviceCallSubmitting = ref(false)
const serviceCallMessage = ref('')
const serviceCallMessageType = ref<'ok' | 'error'>('ok')
const serviceCalls = ref<Array<{ id: string; callType: string; status: string }>>([])
const serviceCallToasts = ref<Array<{ id: number; kind: 'success' | 'error'; message: string }>>([])
let serviceCallToastSeq = 0
let detailPollHandle: number | null = null
const festivalSlug = computed(() => {
  const fromParams = typeof route.params.festival_slug === 'string' ? route.params.festival_slug.trim() : ''
  if (fromParams) return fromParams
  const fromQuery = typeof route.query.festival_slug === 'string' ? route.query.festival_slug.trim() : ''
  return fromQuery
})
const ugcLoading = ref(false)
const ugcSubmitting = ref(false)
const ugcMessage = ref('')
const ugcMessageType = ref<'ok' | 'error'>('ok')
const ugcComposerOpen = ref(false)
const ugcKind = ref<'story' | 'video_review'>('story')
const ugcFile = ref<File | null>(null)
const ugcConsentChecked = ref(false)
const ugcRating = ref(5)
const ugcCategory = ref<'live' | 'food' | 'stage' | 'vibe' | 'quest'>('live')
const ugcOrderId = ref('')
const ugcEligibility = ref<{ canPostStory: boolean; canPostReview: boolean; ordersForReview: FestivalEligibilityOrder[] }>({
  canPostStory: false,
  canPostReview: false,
  ordersForReview: [],
})
type NormalizedOrder = ClientOrder & {
  statusText: string
  paymentText: string
  fulfillmentText: string
  createdAtText: string
  totalText: string
}

function requestHeaders() {
  const shopFromTenant =
    typeof tenantKey.value === 'string' && tenantKey.value.trim() ? tenantKey.value.trim() : ''
  const shopFromQuery =
    typeof route.query.shop_id === 'string' && route.query.shop_id.trim() ? route.query.shop_id.trim() : ''
  const shop = shopFromTenant || shopFromQuery
  return buildMessengerAuthHeaders(shop ? { 'x-shop-id': shop } : undefined)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isUnauthorizedErrorMessage(message: unknown): boolean {
  const text = String(message || '').toLowerCase()
  return text.includes('unauthorized') || text.includes('не авториз')
}

async function waitForMessengerInitData(timeoutMs = 2500) {
  if (!isMessengerMiniApp.value || messengerInitData.value) return
  const startedAt = Date.now()
  while (!messengerInitData.value && Date.now() - startedAt < timeoutMs) {
    await sleep(150)
  }
}

async function fetchOrders(): Promise<{ ok: boolean; items: ClientOrder[] }> {
  const res = await fetch('/api/client-orders', {
    method: 'GET',
    headers: requestHeaders(),
  })
  if (!res.ok) {
    const errJson = (await res.json().catch(() => null)) as any
    throw new Error(errJson?.statusMessage || errJson?.message || 'Не удалось загрузить заказы')
  }
  const json = (await res.json()) as { ok: boolean; items: ClientOrder[] }
  return json ?? { ok: true, items: [] }
}

async function loadFestivalEligibility() {
  if (!festivalSlug.value) return
  ugcLoading.value = true
  ugcMessage.value = ''
  try {
    const res = await fetch(`/api/festival/${encodeURIComponent(festivalSlug.value)}/ugc/eligibility`, {
      method: 'GET',
      headers: requestHeaders(),
    })
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      throw new Error(payload?.statusMessage || 'Не удалось проверить доступ к UGC')
    }
    ugcEligibility.value = {
      canPostStory: payload?.canPostStory === true,
      canPostReview: payload?.canPostReview === true,
      ordersForReview: Array.isArray(payload?.ordersForReview)
        ? payload.ordersForReview.map((x: any) => ({
          id: String(x.id),
          orderNumber: String(x.orderNumber || x.id),
          restaurantName: String(x.restaurantName || 'Корнер'),
        }))
        : [],
    }
    if (!ugcOrderId.value && ugcEligibility.value.ordersForReview.length) {
      ugcOrderId.value = ugcEligibility.value.ordersForReview[0].id
    }
  } catch (err: any) {
    ugcMessageType.value = 'error'
    ugcMessage.value = err?.message || 'Не удалось проверить eligibility'
  } finally {
    ugcLoading.value = false
  }
}

function openUgcComposer(kind: 'story' | 'video_review') {
  ugcKind.value = kind
  ugcComposerOpen.value = true
  ugcFile.value = null
  ugcConsentChecked.value = false
}

function onUgcFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  ugcFile.value = input.files?.[0] || null
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : ''
      resolve(raw.split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

async function submitFestivalUgc() {
  if (!festivalSlug.value || !ugcFile.value || !ugcConsentChecked.value) return
  ugcSubmitting.value = true
  ugcMessage.value = ''
  try {
    const dataBase64 = await fileToBase64(ugcFile.value)
    const uploadRes = await fetch(`/api/festival/${encodeURIComponent(festivalSlug.value)}/ugc/upload`, {
      method: 'POST',
      headers: {
        ...requestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: ugcFile.value.name,
        mimeType: ugcFile.value.type,
        dataBase64,
      }),
    })
    const uploadPayload = await uploadRes.json().catch(() => ({} as any))
    if (!uploadRes.ok || !uploadPayload?.url) {
      throw new Error(uploadPayload?.statusMessage || 'Не удалось загрузить файл')
    }

    const reviewRes = await fetch(`/api/festival/${encodeURIComponent(festivalSlug.value)}/reviews`, {
      method: 'POST',
      headers: {
        ...requestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: ugcKind.value,
        rating: ugcKind.value === 'video_review' ? ugcRating.value : null,
        category: ugcCategory.value,
        orderId: ugcKind.value === 'video_review' ? ugcOrderId.value : null,
        mediaUrl: uploadPayload.url,
        mediaPath: uploadPayload.path || null,
      }),
    })
    const reviewPayload = await reviewRes.json().catch(() => ({} as any))
    if (!reviewRes.ok) {
      throw new Error(reviewPayload?.statusMessage || 'Не удалось отправить отзыв')
    }
    ugcMessageType.value = 'ok'
    ugcMessage.value = 'UGC отправлен на модерацию'
    ugcComposerOpen.value = false
    await loadFestivalEligibility()
  } catch (err: any) {
    ugcMessageType.value = 'error'
    ugcMessage.value = err?.message || 'Не удалось отправить UGC'
  } finally {
    ugcSubmitting.value = false
  }
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
    const fetchDetail = async () => {
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
      return (await res.json()) as { ok: boolean; order?: ClientOrderStatusDetail }
    }
    const json = await fetchDetail()
    if (!json?.ok || !json.order) {
      throw new Error('Некорректный ответ сервера')
    }
    detailOrder.value = json.order
    syncListOrderWithDetail(json.order)
    if (isHallOrderFulfillmentType(json.order.fulfillmentType)) {
      await loadServiceCalls()
    } else {
      serviceCalls.value = []
      serviceCallMessage.value = ''
    }
    const st = (json.order.status || '').toLowerCase()
    if (st === 'cancelled' || st === 'handed_to_customer' || st === 'done') {
      if (detailPollHandle != null) {
        window.clearInterval(detailPollHandle)
        detailPollHandle = null
      }
    }
  } catch (e: any) {
    const maybeUnauthorized = isUnauthorizedErrorMessage(e?.message)
    if (isMessengerMiniApp.value && maybeUnauthorized && !messengerInitData.value) {
      try {
        await waitForMessengerInitData(4000)
        const retryRes = await fetch(
          `/api/client-order-status?orderId=${encodeURIComponent(selectedOrderId.value)}`,
          {
            method: 'GET',
            headers: requestHeaders(),
          },
        )
        if (!retryRes.ok) {
          const retryErrJson = (await retryRes.json().catch(() => null)) as any
          throw new Error(retryErrJson?.statusMessage || retryErrJson?.message || 'Не удалось загрузить статус заказа')
        }
        const retryJson = (await retryRes.json()) as { ok: boolean; order?: ClientOrderStatusDetail }
        if (!retryJson?.ok || !retryJson.order) {
          throw new Error('Некорректный ответ сервера')
        }
        detailOrder.value = retryJson.order
        syncListOrderWithDetail(retryJson.order)
        detailErrorMessage.value = ''
        if (isHallOrderFulfillmentType(retryJson.order.fulfillmentType)) {
          await loadServiceCalls()
        } else {
          serviceCalls.value = []
          serviceCallMessage.value = ''
        }
      } catch (retryError: any) {
        detailErrorMessage.value = retryError?.message || 'Не удалось загрузить статус заказа'
      }
    } else {
      detailErrorMessage.value = e?.message || 'Не удалось загрузить статус заказа'
    }
  }
}

function syncListOrderWithDetail(detail: ClientOrderStatusDetail) {
  const current = data.value?.items || []
  if (!current.length) return
  const next = current.map((item: ClientOrder) => {
    if (item.id !== detail.id) return item
    const normalizedStatus = (detail.status || '').toLowerCase()
    return {
      ...item,
      status: normalizedStatus || item.status,
      total: Number.isFinite(detail.total) ? detail.total : item.total,
      restaurantName: detail.restaurantName || item.restaurantName,
      isActive: activeOrderStatuses.has(normalizedStatus),
    }
  })
  data.value = { ...(data.value || { ok: true, items: [] }), items: next }
}

function serviceCallTypeLabel(type: string) {
  if (type === 'call_waiter') return 'Позвать официанта'
  if (type === 'call_hookah') return 'Позвать кальянщика'
  if (type === 'request_bill') return 'Выставить счет'
  return type
}

function serviceCallStatusLabel(status: string) {
  if (status === 'created') return 'Отправлен'
  if (status === 'acknowledged') return 'Скоро подойдут'
  if (status === 'in_progress') return 'Уже идут'
  if (status === 'resolved') return 'Выполнено'
  if (status === 'cancelled') return 'Отменен'
  return status
}

async function loadServiceCalls() {
  if (!selectedOrderId.value || !showOrderHallService.value) return
  const res = await fetch(`/api/service-calls?orderId=${encodeURIComponent(selectedOrderId.value)}`, {
    method: 'GET',
    headers: requestHeaders(),
  })
  const payload = await res.json().catch(() => ({} as any))
  if (!res.ok) {
    serviceCalls.value = []
    return
  }
  serviceCalls.value = Array.isArray(payload?.items)
    ? payload.items.map((x: any) => ({
      id: String(x.id),
      callType: String(x.callType || ''),
      status: String(x.status || ''),
    }))
    : []
}

async function createServiceCall(callType: 'call_waiter' | 'call_hookah' | 'request_bill') {
  if (!selectedOrderId.value || !showOrderHallService.value) return
  serviceCallSubmitting.value = true
  serviceCallMessage.value = ''
  const idempotencyKey = `${callType}:${Date.now()}`
  try {
    const res = await fetch('/api/service-calls', {
      method: 'POST',
      headers: {
        ...requestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: selectedOrderId.value,
        callType,
        idempotencyKey,
      }),
    })
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      throw new Error(payload?.statusMessage || 'Не удалось отправить запрос')
    }
    serviceCallMessageType.value = 'ok'
    serviceCallMessage.value = 'Запрос отправлен персоналу'
    pushServiceCallToast('success', 'Запрос отправлен персоналу', 3200)
    await loadServiceCalls()
  } catch (err: any) {
    serviceCallMessageType.value = 'error'
    serviceCallMessage.value = err?.message || 'Не удалось отправить запрос'
    pushServiceCallToast('error', serviceCallMessage.value, 4200)
  } finally {
    serviceCallSubmitting.value = false
  }
}

function parseMaxReviewRateFromStartParam(raw: string): { orderId: string; stars: number } | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s.startsWith('reviewrate_')) return null
  const rest = s.slice('reviewrate_'.length)
  const lastUnderscore = rest.lastIndexOf('_')
  if (lastUnderscore <= 0) return null
  const orderId = rest.slice(0, lastUnderscore).trim().toLowerCase()
  const stars = Number(rest.slice(lastUnderscore + 1))
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId) || !Number.isFinite(stars) || stars < 1 || stars > 5) {
    return null
  }
  return { orderId, stars: Math.round(stars) }
}

async function trySubmitMaxReviewFromStartParam() {
  if (!import.meta.client) return
  const w = window as any
  const raw = String(w?.WebApp?.initDataUnsafe?.start_param || route.query.startapp || '').trim()
  const parsed = parseMaxReviewRateFromStartParam(raw)
  if (!parsed) return
  const list = data.value?.items || []
  const order = list.find((x: ClientOrder) => x.id === parsed.orderId)
  const sid = (order && typeof order.shopId === 'string' && order.shopId.trim()) || primaryShopId.value
  if (!sid) return
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestHeaders(),
      'x-shop-id': sid,
    }
    let res = await fetch('/api/reviews', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: parsed.orderId,
        rating: parsed.stars,
        comment: null,
        videoUrl: null,
      }),
    })
    if (res.status === 409) {
      res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderId: parsed.orderId, rating: parsed.stars }),
      })
    }
    if (!res.ok) return
    markReviewSubmitted(parsed.orderId)
    pushServiceCallToast('success', `Оценка ${parsed.stars} из 5 сохранена`)
    data.value = await fetchOrders()
  } catch {
    /* ignore */
  }
}

function pushServiceCallToast(kind: 'success' | 'error', message: string, durationMs = 2600) {
  const text = (message || '').trim()
  if (!text) return
  const id = ++serviceCallToastSeq
  serviceCallToasts.value = [...serviceCallToasts.value, { id, kind, message: text }]
  setTimeout(() => {
    serviceCallToasts.value = serviceCallToasts.value.filter((item: { id: number }) => item.id !== id)
  }, durationMs)
}

onMounted(async () => {
  pending.value = true
  errorMessage.value = ''
  loadReviewedOrderIdsFromStorage()
  try {
    await waitForMessengerInitData()
    data.value = await fetchOrders()
    await loadReviewModuleFlagsForOrders()
    await trySubmitMaxReviewFromStartParam()
    if (festivalSlug.value) {
      await loadFestivalEligibility()
    }
  } catch (error: any) {
    const maybeUnauthorized = isUnauthorizedErrorMessage(error?.message)
    if (isMessengerMiniApp.value && maybeUnauthorized && !messengerInitData.value) {
      try {
        await waitForMessengerInitData(4000)
        data.value = await fetchOrders()
        await loadReviewModuleFlagsForOrders()
        await trySubmitMaxReviewFromStartParam()
        errorMessage.value = ''
      } catch (retryError: any) {
        errorMessage.value = retryError?.statusMessage || retryError?.message || 'Не удалось загрузить заказы'
      }
    } else {
      errorMessage.value = error?.statusMessage || error?.message || 'Не удалось загрузить заказы'
    }
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

watch(festivalSlug, async (next: string) => {
  if (!next) return
  await loadFestivalEligibility()
})

watch(
  () => data.value.items,
  () => {
    void loadReviewModuleFlagsForOrders()
  },
  { deep: true },
)

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
  if (type === 'qr-menu') return 'В\u00A0ресторане'
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

const eligibleReviewOrders = computed(() =>
  normalizedOrders.value.filter((o: NormalizedOrder) => {
    if (o.isActive) return false
    if (!orderCompletedForReview(o.status)) return false
    if (o.hasShopReview) return false
    if (reviewedOrderIds.value.includes(o.id)) return false
    const sid = (typeof o.shopId === 'string' && o.shopId.trim()) || primaryShopId.value
    if (!sid) return false
    return shopReviewModuleEnabled.value[sid] === true
  }),
)

const filteredOrders = computed(() => {
  const q = query.value.toLowerCase()
  let list = normalizedOrders.value

  if (!isTenantOrdersPage.value) {
    list = list.filter((order: NormalizedOrder) => order.restaurantName.toLowerCase().includes(q))
  }

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
