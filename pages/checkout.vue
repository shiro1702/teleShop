<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <NuxtLink
          to="/"
          class="flex items-center gap-3 text-gray-600 transition hover:text-gray-900"
        >
          <img
            src="/logo.webp"
            alt="Логотип"
            class="h-10 w-10 rounded-full object-cover"
          />
          <span class="hidden text-sm sm:inline">
            ← Назад в магазин
          </span>
        </NuxtLink>
        <div class="text-right">
          <h1 class="text-xl font-bold text-gray-900">
            Оформление заказа
          </h1>
          <p
            v-if="cartStore.count > 0"
            class="text-sm text-[#2563eb]"
          >
            {{ cartStore.count }} шт. · {{ formatPrice(cartStore.total) }}
          </p>
        </div>
        <span class="w-24" />
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <CheckoutSteps :current-step="state.currentStep" />

      <div class="space-y-6">
        <!-- Шаг 1: корзина -->
        <section v-if="state.currentStep === 1">
          <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div v-if="cartStore.items.length === 0" class="py-10 text-center">
              <p class="text-gray-500">
                Корзина пуста
              </p>
              <NuxtLink
                to="/"
                class="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition hover:bg-[#1d4ed8]"
              >
                Перейти к товарам
              </NuxtLink>
            </div>
            <template v-else>
              <ul class="space-y-4">
                <CartItem
                  v-for="item in cartStore.items"
                  :key="item.id"
                  :item="item"
                />
              </ul>
            </template>
          </div>

          <div
            v-if="cartStore.items.length > 0"
            class="mt-4 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
          >
            <div class="space-y-1 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Товары</span>
                <span class="font-semibold text-gray-900">
                  {{ formatPrice(cartStore.total) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Доставка</span>
                <span
                  class="font-semibold"
                  :class="cartStore.deliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'"
                >
                  {{ cartStore.deliveryCost === 0 ? '0 ₽' : formatPrice(cartStore.deliveryCost) }}
                </span>
              </div>
              <div class="flex items-center justify-between border-t border-dashed border-gray-200 pt-2">
                <span class="font-semibold text-gray-900">
                  Итого
                </span>
                <span class="text-xl font-bold text-[#2563eb]">
                  {{ formatPrice(cartStore.grandTotal) }}
                </span>
              </div>
            </div>

            <div class="flex flex-1 flex-col gap-2 sm:max-w-xs">
              <button
                type="button"
                class="w-full rounded-lg bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-gray-300"
                :disabled="!canGoToAddress"
                @click="goToStep(2)"
              >
                Далее: адрес доставки
              </button>
              <p
                v-if="!cartStore.canCheckout && cartStore.deliverySummary.minOrderAmount"
                class="text-xs text-red-600"
              >
                Минимальная сумма заказа для вашей зоны — {{ formatPrice(cartStore.deliverySummary.minOrderAmount) }}.
              </p>
            </div>
          </div>
        </section>

        <!-- Шаг 2: адрес/доставка -->
        <section v-else-if="state.currentStep === 2">
          <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div class="space-y-3">
              <div
                v-if="savedAddresses.length"
                class="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
              >
                <p class="text-xs font-medium text-gray-500">
                  Ранее использованные адреса
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="addr in savedAddresses"
                    :key="addr.id"
                    type="button"
                    class="group flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-[#2563eb] hover:bg-blue-50"
                    @click="applySavedAddress(addr)"
                  >
                    <span class="max-w-[160px] truncate sm:max-w-[220px]">
                      {{ addr.address }}
                    </span>
                    <div
                      class="ml-1 text-gray-400 hover:text-red-500"
                      @click.stop="deleteSavedAddress(addr.id)"
                      aria-label="Удалить адрес"
                    >
                      ×
                    </div>
                  </button>
                </div>
              </div>

              <section class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div class="space-y-2">
                  <div class="relative">
                    <input
                      ref="addressInputRef"
                      v-model="addressLine"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
                      placeholder="Улан-Удэ, улица, дом"
                      @input="onAddressInput"
                    />
                    <div
                      v-if="isSuggestLoading"
                      class="pointer-events-none absolute inset-y-0 right-2 flex items-center"
                    >
                      <svg
                        class="h-4 w-4 animate-spin text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        />
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                    </div>
                    <div
                      v-if="suggestItems.length"
                      class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                    >
                      <button
                        v-for="item in suggestItems"
                        :key="item.value"
                        type="button"
                        class="flex w-full items-center justify-between px-4 py-3 text-left text-base text-gray-800 transition hover:bg-gray-50"
                        @click="selectSuggestion(item)"
                      >
                        <span class="truncate">
                          {{ item.displayName }}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      v-model="flat"
                      type="text"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
                      placeholder="Квартира / подъезд"
                    />
                    <textarea
                      v-model="comment"
                      rows="2"
                      class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
                      placeholder="Комментарий курьеру"
                    />
                  </div>
                  <p
                    v-if="cartStore.deliverySummary.message"
                    class="text-xs text-gray-500"
                  >
                    {{ cartStore.deliverySummary.message }}
                  </p>
                </div>
              </section>
            </div>
          </div>

          <div class="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              class="w-full rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              @click="goToStep(1)"
            >
              Назад к корзине
            </button>
            <button
              type="button"
              class="w-full rounded-lg bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
              :disabled="!canGoToSummary"
              @click="goToStep(3)"
            >
              Далее: оплата и подтверждение
            </button>
          </div>
        </section>

        <!-- Шаг 3: итог и оплата -->
        <section v-else-if="state.currentStep === 3">
          <div class="space-y-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 class="mb-3 text-base font-semibold text-gray-900 sm:text-lg">
                Состав заказа
              </h2>
              <ul class="divide-y divide-gray-100">
                <li
                  v-for="item in cartStore.items"
                  :key="item.id"
                  class="flex items-center justify-between py-2 text-sm"
                >
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">
                      {{ item.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ item.quantity }} × {{ formatPrice(item.price) }}
                    </p>
                  </div>
                  <p class="ml-2 text-sm font-semibold text-gray-900">
                    {{ formatPrice(item.price * item.quantity) }}
                  </p>
                </li>
              </ul>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 class="mb-3 text-base font-semibold text-gray-900 sm:text-lg">
                Адрес и доставка
              </h2>
              <p class="text-sm text-gray-800">
                {{ addressLine || 'Адрес не указан' }}
              </p>
              <p
                v-if="flat"
                class="mt-1 text-xs text-gray-600"
              >
                {{ flat }}
              </p>
              <p
                v-if="comment"
                class="mt-1 text-xs text-gray-500"
              >
                {{ comment }}
              </p>
              <p
                v-if="cartStore.deliverySummary.message"
                class="mt-2 text-xs text-gray-500"
              >
                {{ cartStore.deliverySummary.message }}
              </p>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 class="mb-3 text-base font-semibold text-gray-900 sm:text-lg">
                Способ оплаты
              </h2>
              <div class="space-y-2">
                <label class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="state.paymentMethod"
                      type="radio"
                      value="cash"
                      class="h-4 w-4 text-[#2563eb]"
                    >
                    <div>
                      <p class="font-medium text-gray-900">
                        Наличные курьеру
                      </p>
                      <p class="text-xs text-gray-500">
                        Оплата наличными при получении
                      </p>
                    </div>
                  </div>
                </label>
                <div
                  v-if="state.paymentMethod === 'cash'"
                  class="mt-1 space-y-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                >
                  <label class="flex flex-col gap-1">
                    <span>С какой суммы подготовить сдачу (необязательно)</span>
                    <div class="flex items-center gap-2">
                      <input
                        v-model="changeFrom"
                        type="number"
                        min="0"
                        step="1"
                        inputmode="numeric"
                        class="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                        placeholder="2000"
                      >
                      <span class="text-gray-500">₽</span>
                    </div>
                  </label>
                </div>
                <label class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="state.paymentMethod"
                      type="radio"
                      value="card_courier"
                      class="h-4 w-4 text-[#2563eb]"
                    >
                    <div>
                      <p class="font-medium text-gray-900">
                        Картой курьеру
                      </p>
                      <p class="text-xs text-gray-500">
                        Курьер привезёт терминал
                      </p>
                    </div>
                  </div>
                </label>
                <label class="flex cursor-not-allowed items-center justify-between rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm opacity-70">
                  <div class="flex items-center gap-2">
                    <input
                      type="radio"
                      value="online"
                      disabled
                      class="h-4 w-4 text-[#2563eb]"
                    >
                    <div>
                      <p class="font-medium text-gray-400">
                        Оплата на сайте
                      </p>
                      <p class="text-xs text-gray-400">
                        Скоро появится
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Товары</span>
                  <span class="font-semibold text-gray-900">
                    {{ formatPrice(cartStore.total) }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Доставка</span>
                  <span
                    class="font-semibold"
                    :class="cartStore.deliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'"
                  >
                    {{ cartStore.deliveryCost === 0 ? '0 ₽' : formatPrice(cartStore.deliveryCost) }}
                  </span>
                </div>
                <div class="flex items-center justify-between border-t border-dashed border-gray-200 pt-2">
                  <span class="font-semibold text-gray-900">
                    Итого к оплате
                  </span>
                  <span class="text-xl font-bold text-[#2563eb]">
                    {{ formatPrice(cartStore.grandTotal) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                class="w-full rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                @click="goToStep(2)"
              >
                Назад к адресу
              </button>

              <!-- Блок кнопок оформления зависит от авторизации -->
              <div class="flex w-full flex-col gap-2 sm:w-auto">
                <!-- Авторизован (Supabase) или TMA: сразу оформляем -->
                <button
                  v-if="isAuthorizedForOrder"
                  type="button"
                  class="w-full rounded-lg bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                  :disabled="isPlacing || !cartStore.items.length || !canGoToSummary"
                  @click="placeOrder"
                >
                  <span v-if="isPlacing">Оформляем заказ...</span>
                  <span v-else>Оформить заказ</span>
                </button>

                <!-- Не авторизован в вебе: предлагаем авторизацию и TMA -->
                <template v-else>
                  <button
                    type="button"
                    class="w-full rounded-lg bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition hover:bg-[#1d4ed8] sm:w-auto"
                    @click="authAndReturn"
                  >
                    Авторизоваться и оформить
                  </button>
                  <button
                    type="button"
                    class="w-full rounded-lg border border-[#2563eb] px-4 py-3 text-base font-medium text-[#2563eb] transition hover:bg-blue-50 sm:w-auto"
                    @click="continueInTelegramFromCheckout"
                  >
                    Продолжить в Telegram‑боте
                  </button>
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCheckoutAddress } from '~/composables/useCheckoutAddress'

const cartStore = useCartStore()
const route = useRoute()
const { isTelegram, webApp } = useTelegram()
const supabaseUser = useSupabaseUser()
const config = useRuntimeConfig()

const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() =>
  telegramBotName ? `https://t.me/${telegramBotName}` : null,
)

type PaymentMethod = 'cash' | 'card_courier' | 'online'

type CheckoutState = {
  currentStep: 1 | 2 | 3
  paymentMethod: PaymentMethod
}

const CHECKOUT_STORAGE_KEY = 'teleshop_checkout_state'

const state = reactive<CheckoutState>({
  currentStep: 1,
  paymentMethod: 'cash',
})

const isPlacing = ref(false)
const changeFrom = ref<string>('')

const {
  addressLine,
  flat,
  comment,
  addressInputRef,
  suggestItems,
  isSuggestLoading,
  savedAddresses,
  onAddressInput,
  selectSuggestion,
  applySavedAddress,
  deleteSavedAddress,
} = useCheckoutAddress()

const canGoToAddress = computed(
  () => cartStore.items.length > 0,
)

const canGoToSummary = computed(() => {
  const hasHouseNumber = /\d/.test(addressLine.value.trim())
  return hasHouseNumber && cartStore.items.length > 0
})

const isAuthorizedForOrder = computed(() => {
  // В TMA авторизацию обеспечивает initData, в вебе — Supabase-сессия
  return isTelegram.value || !!supabaseUser.value
})

function goToStep(step: 1 | 2 | 3) {
  state.currentStep = step
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

function serializeState() {
  return JSON.stringify({
    currentStep: state.currentStep,
    paymentMethod: state.paymentMethod,
    addressLine: addressLine.value,
    flat: flat.value,
    comment: comment.value,
    changeFrom: changeFrom.value,
  })
}

function restoreFromPlainObject(obj: any) {
  if (!obj || typeof obj !== 'object') return

  if (obj.currentStep === 2 || obj.currentStep === 3) {
    state.currentStep = obj.currentStep
  }
  if (obj.paymentMethod === 'cash' || obj.paymentMethod === 'card_courier' || obj.paymentMethod === 'online') {
    state.paymentMethod = obj.paymentMethod
  }
  if (typeof obj.addressLine === 'string') {
    addressLine.value = obj.addressLine
  }
  if (typeof obj.flat === 'string') {
    flat.value = obj.flat
  }
  if (typeof obj.comment === 'string') {
    comment.value = obj.comment
  }
  if (typeof obj.changeFrom === 'string') {
    changeFrom.value = obj.changeFrom
  }
}

function isClient() {
  return typeof window !== 'undefined'
}

function persistCheckoutStateLocal(data: string) {
  if (!isClient()) return
  try {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, data)
  } catch {
    // ignore
  }
}

function loadCheckoutStateLocal() {
  if (!isClient()) return null
  try {
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistCheckoutStateCloud(data: string) {
  if (!isTelegram.value || !webApp.value?.CloudStorage) {
    persistCheckoutStateLocal(data)
    return
  }

  webApp.value.CloudStorage.setItem(CHECKOUT_STORAGE_KEY, data, () => {
    persistCheckoutStateLocal(data)
  })
}

function loadCheckoutStateCloud(): Promise<any | null> {
  if (!isTelegram.value || !webApp.value?.CloudStorage) {
    return Promise.resolve(loadCheckoutStateLocal())
  }

  return new Promise((resolve) => {
    webApp.value!.CloudStorage.getItem(
      CHECKOUT_STORAGE_KEY,
      (_err: unknown, value: string | null) => {
        if (value) {
          try {
            resolve(JSON.parse(value))
            return
          } catch {
            // fall through to local
          }
        }
        resolve(loadCheckoutStateLocal())
      },
    )
  })
}

watch(
  () => ({
    currentStep: state.currentStep,
    paymentMethod: state.paymentMethod,
    addressLine: addressLine.value,
    flat: flat.value,
    comment: comment.value,
  }),
  () => {
    const data = serializeState()
    persistCheckoutStateCloud(data)
  },
  { deep: true },
)

onMounted(async () => {
  const saved = await loadCheckoutStateCloud()
  if (saved) {
    restoreFromPlainObject(saved)
  }

  const stepParam = Number(route.query.step || 0)
  if (stepParam === 2 || stepParam === 3) {
    if (stepParam === 2 && cartStore.items.length > 0) {
      state.currentStep = 2
    } else if (stepParam === 3 && cartStore.items.length > 0 && canGoToSummary.value) {
      state.currentStep = 3
    }
  }
})

async function placeOrder() {
  if (isPlacing.value || !cartStore.items.length || !canGoToSummary.value) return

  isPlacing.value = true
  try {
    const body: any = {
      items: cartStore.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      address: {
        line: addressLine.value || null,
        flat: flat.value || null,
        comment: comment.value || null,
        zone: cartStore.deliveryZone ?? null,
      },
      paymentMethod: state.paymentMethod,
      changeFrom: state.paymentMethod === 'cash' && Number.isFinite(Number.parseInt(changeFrom.value, 10))
        ? Number.parseInt(changeFrom.value, 10)
        : null,
    }

    if (isTelegram.value && webApp.value?.initData) {
      body.initData = webApp.value.initData
    }

    const res = await $fetch<{ ok: boolean; orderId?: string }>('/api/order', {
      method: 'POST',
      body,
    })

    if (res?.ok) {
      const data = serializeState()
      persistCheckoutStateCloud(data)
      cartStore.clear()
      if (isClient()) {
        localStorage.removeItem(CHECKOUT_STORAGE_KEY)
      }
      // Пока просто редиректим на главную, позже можно сделать отдельную страницу успеха
      await navigateTo({ path: '/', query: { orderId: res.orderId ?? undefined } })
    } else if (isClient()) {
      window.alert('Не удалось оформить заказ. Попробуйте ещё раз.')
    }
  } catch (error: any) {
    const status = error?.statusCode || error?.status
    if (isClient() && !isTelegram.value && (status === 401 || status === 409)) {
      await navigateTo({
        path: '/link-telegram',
        query: { redirect: '/checkout' },
      })
      return
    }
    if (isClient()) {
      window.alert('Ошибка при отправке заказа. Попробуйте ещё раз.')
    }
  } finally {
    isPlacing.value = false
  }
}

function authAndReturn() {
  if (!telegramBotUrl.value) return
  if (!isClient()) return
  const url = `${telegramBotUrl.value}?start=auth_link`
  window.open(url, '_blank', 'noopener')
}

async function continueInTelegramFromCheckout() {
  if (!cartStore.items.length) return

  try {
    const res = await $fetch<{ ok: boolean; deepLink: string }>('/api/cart-bridge', {
      method: 'POST',
      body: {
        items: cartStore.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      },
    })

    if (res?.ok && res.deepLink) {
      if (isClient()) {
        window.location.href = res.deepLink
      }
    } else if (isClient()) {
      window.alert('Не удалось подготовить корзину для Telegram. Попробуйте ещё раз.')
    }
  } catch {
    if (isClient()) {
      window.alert('Ошибка при подготовке корзины для Telegram. Попробуйте ещё раз.')
    }
  }
}
</script>

