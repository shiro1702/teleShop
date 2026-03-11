<template>
  <!-- Модалка успешного заказа -->
  <Teleport to="body">
    <Transition name="success">
      <div
        v-if="showOrderSuccess"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-success-title"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="closeSuccessModal"
        />
        <div
          class="relative flex w-full max-w-sm flex-col items-center rounded-2xl bg-white p-8 shadow-xl"
          @click.stop
        >
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              class="h-9 w-9 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 id="order-success-title" class="text-xl font-bold text-gray-900">
            Заказ оформлен!
          </h2>
          <p v-if="lastOrderId" class="mt-2 text-gray-500">
            Номер заказа: <span class="font-semibold text-gray-700">#{{ lastOrderId }}</span>
          </p>
          <p class="mt-1 text-sm text-gray-500">
            Менеджер свяжется с вами в Telegram.
          </p>
          <button
            type="button"
            class="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 active:bg-emerald-800"
            @click="closeSuccessModal"
          >
            Понятно
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="cart">
      <div
        v-if="cartStore.isCartModalOpen"
        class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <!-- Оверлей -->
        <div
          class="absolute inset-0 bg-black/50"
          @click="cartStore.closeCartModal()"
        />
        <!-- Боттомшит (моб) / модалка (десктоп) -->
        <div
          class="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-gray-50 shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:pb-0"
          :style="isTelegram ? {
            paddingBottom: 'env(safe-area-inset-bottom)',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, var(--tg-theme-bg-color))',
            color: 'var(--tg-theme-text-color)'
          } : {}"
          @click.stop
        >
          <!-- Ручка боттомшита только на мобильных -->
          <div class="flex shrink-0 justify-center pt-2 sm:hidden">
            <span class="h-1 w-12 rounded-full bg-gray-300" aria-hidden="true" />
          </div>
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <h2 id="cart-title" class="text-lg font-bold text-gray-900 sm:text-xl">
              Корзина
            </h2>
            <button
              type="button"
              class="-mr-2 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Закрыть"
              @click="cartStore.closeCartModal()"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Прокручиваемый список (только товары) -->
          <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div v-if="cartStore.items.length === 0" class="py-12 text-center">
              <p class="text-gray-500">Корзина пуста</p>
              <button
                type="button"
                class="mt-4 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8]"
                @click="cartStore.closeCartModal()"
              >
                Перейти к товарам
              </button>
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
          <!-- Итого, очистить и оформить заказ закреплено снизу -->
          <div
            v-if="cartStore.items.length > 0"
            class="shrink-0 space-y-3 border-t border-gray-200 bg-white p-4 sm:px-6 sm:py-4 sm:pb-4"
            :style="isTelegram ? {
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              backgroundColor: 'var(--tg-theme-bg-color)',
              color: 'var(--tg-theme-text-color)',
              borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))'
            } : {}"
          >
            <div class="flex justify-end">
              <button
                type="button"
                class="text-sm text-gray-500 transition hover:text-red-600"
                @click="cartStore.clear(); cartStore.closeCartModal()"
              >
                Очистить корзину
              </button>
            </div>
            <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Товары</span>
                <span class="font-semibold text-gray-900">
                  {{ formatPrice(cartStore.total) }}
                </span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Доставка</span>
                <span class="font-semibold" :class="cartStore.deliveryCost === 0 ? 'text-emerald-600' : 'text-gray-900'">
                  {{ cartStore.deliveryCost === 0 ? '0 ₽' : formatPrice(cartStore.deliveryCost) }}
                </span>
              </div>
              <div class="flex items-center justify-between border-t border-dashed border-gray-200 pt-2">
                <span class="font-semibold text-gray-900">Итого:</span>
                <span class="text-xl font-bold text-[#2563eb]">
                  {{ formatPrice(cartStore.grandTotal) }}
                </span>
              </div>
              <button
                type="button"
                class="mt-1 w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
                @click="openAddressModal"
              >
                Оформить заказ
              </button>
              <p
                v-if="!cartStore.canCheckout && cartStore.deliverySummary.minOrderAmount"
                class="text-xs text-red-600"
              >
                Минимальная сумма заказа для вашей зоны — {{ formatPrice(cartStore.deliverySummary.minOrderAmount) }}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Отдельная модалка адреса/доставки -->
  <Teleport to="body">
    <Transition name="cart">
      <div
        v-if="showAddressModal"
        class="fixed inset-0 z-[55] flex items-end sm:items-center sm:justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="absolute inset-0 bg-black/40"
          @click="closeAddressModal"
        />
        <div
          class="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-gray-50 shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
          @click.stop
        >
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <h2 class="text-lg font-bold text-gray-900 sm:text-xl">
              Адрес доставки
            </h2>
            <button
              type="button"
              class="-mr-2 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Закрыть"
              @click="closeAddressModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div v-if="savedAddresses.length" class="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
              <p class="text-xs font-medium text-gray-500">
                Ранее использованные адреса
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="addr in savedAddresses"
                  :key="addr.id"
                  type="button"
                  class="group flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-[#2563eb] hover:bg-blue-50"
                  @click="applySavedAddress(addr)"
                >
                  <span class="truncate max-w-[160px]">{{ addr.address }}</span>
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
            <section class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <div class="space-y-2">
                <div class="relative">
                  <input
                    ref="addressInputRef"
                    v-model="addressQuery"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
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
                      class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                      @click="selectSuggestion(item)"
                    >
                      <span class="truncate">{{ item.displayName }}</span>
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    v-model="flat"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    placeholder="Квартира / подъезд"
                  />
                  <textarea
                    v-model="comment"
                    rows="2"
                    class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    placeholder="Комментарий курьеру"
                  />
                </div>
                <p v-if="cartStore.deliverySummary.message" class="text-xs text-gray-500">
                  {{ cartStore.deliverySummary.message }}
                </p>
                <p v-if="deliveryChangeMessage" class="text-xs text-amber-600">
                  {{ deliveryChangeMessage }}
                </p>
              </div>
            </section>
          </div>
          <div class="shrink-0 border-t border-gray-200 bg-white p-4 sm:px-6 sm:py-4">
            <button
              type="button"
              class="w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
              @click="confirmAddressAndCheckout"
            >
              Подтвердить адрес и оформить
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { yandexGeocode, yandexSuggest } from '~/utils/yandexApi'
import { useDeliveryZone } from '~/composables/useDeliveryZone'
import { useTelegram } from '~/composables/useTelegram'

type SavedAddress = {
  id: string
  address: string
  flat?: string
  comment?: string
}

const cartStore = useCartStore()
const showOrderSuccess = ref(false)
const lastOrderId = ref<string | null>(null)
const showAddressModal = ref(false)
const addressQuery = ref('')
const flat = ref('')
const comment = ref('')
const addressInputRef = ref<HTMLInputElement | null>(null)
const suggestItems = ref<Array<{ displayName: string; value: string }>>([])
const savedAddresses = ref<SavedAddress[]>([])
const isSuggestLoading = ref(false)

const { properties: deliveryZoneProps, reason, refresh: refreshZone } = useDeliveryZone()
const { isTelegram, webApp } = useTelegram()

const STORAGE_KEY = 'teleshop_addresses'
const lastKnownDeliveryCost = ref(0)
const deliveryChangeMessage = ref('')

function closeSuccessModal() {
  showOrderSuccess.value = false
  lastOrderId.value = null
}

function onAddressInput() {
  const query = addressQuery.value.trim()
  if (query.length > 0) {
    cartStore.setDeliveryError(null)
  }

  suggestItems.value = []
  if (query.length < 3) {
    isSuggestLoading.value = false
    return
  }

  // debounce через замыкание на функции
  const fn = onAddressInput as any
  if (fn._timer) {
    clearTimeout(fn._timer)
  }
  fn._timer = setTimeout(async () => {
    isSuggestLoading.value = true
    try {
      const currentQuery = addressQuery.value.trim()
      if (currentQuery.length < 3) {
        suggestItems.value = []
        return
      }
      const items = await yandexSuggest(currentQuery)
      suggestItems.value = items
    } finally {
      isSuggestLoading.value = false
    }
  }, 400)
}

async function selectSuggestion(item: { displayName: string; value: string }) {
  addressQuery.value = item.displayName
  suggestItems.value = []
  isSuggestLoading.value = false

  const geo = await yandexGeocode(item.displayName)
  if (!geo) return

  refreshZone(geo.lat, geo.lon)
}

watch(
  () => cartStore.isCartModalOpen,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        addressInputRef.value?.focus()
      })
    }
  }
)

watch(
  deliveryZoneProps,
  (zone) => {
    cartStore.setDeliveryZone(zone ?? null)
  }
)

watch(reason, (val) => {
  if (val === 'out_of_zone') {
    cartStore.setDeliveryZone(null)
  }
})

function applySavedAddress(addr: SavedAddress) {
  addressQuery.value = addr.address
  flat.value = addr.flat ?? ''
  comment.value = addr.comment ?? ''
}

async function loadSavedAddresses() {
  // Если мы внутри Telegram Web App — пробуем CloudStorage
  if (isTelegram.value && webApp.value?.CloudStorage) {
    await new Promise<void>((resolve) => {
      webApp.value!.CloudStorage.getItem(STORAGE_KEY, (err: unknown, value: string | null) => {
        if (!err && value) {
          try {
            savedAddresses.value = JSON.parse(value) as SavedAddress[]
          } catch {
            savedAddresses.value = []
          }
        }
        resolve()
      })
    })
    return
  }

  // Фоллбек на localStorage
  if (process.client) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        savedAddresses.value = JSON.parse(raw) as SavedAddress[]
      }
    } catch {
      savedAddresses.value = []
    }
  }
}

async function persistAddresses() {
  const data = JSON.stringify(savedAddresses.value)

  if (isTelegram.value && webApp.value?.CloudStorage) {
    await new Promise<void>((resolve) => {
      webApp.value!.CloudStorage.setItem(STORAGE_KEY, data, () => resolve())
    })
  } else if (process.client) {
    localStorage.setItem(STORAGE_KEY, data)
  }
}

async function saveCurrentAddress() {
  const line = addressQuery.value.trim()
  if (!line) return

  const existing = savedAddresses.value.find(
    (a) => a.address === line && a.flat === flat.value.trim()
  )
  if (existing) return

  savedAddresses.value.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    address: line,
    flat: flat.value.trim() || undefined,
    comment: comment.value.trim() || undefined,
  })

  // ограничим историю, например, 5 адресами
  savedAddresses.value = savedAddresses.value.slice(0, 5)
  await persistAddresses()
}

async function deleteSavedAddress(id: string) {
  savedAddresses.value = savedAddresses.value.filter((a) => a.id !== id)
  await persistAddresses()
}

onMounted(() => {
  loadSavedAddresses()
})

function openAddressModal() {
  lastKnownDeliveryCost.value = cartStore.deliveryCost
  deliveryChangeMessage.value = ''
  showAddressModal.value = true
  nextTick(() => {
    addressInputRef.value?.focus()
  })
}

function closeAddressModal() {
  showAddressModal.value = false
}

async function confirmAddressAndCheckout() {
  const hasHouseNumber = /\d/.test(addressQuery.value.trim())
  if (!hasHouseNumber) {
    nextTick(() => {
      const el = addressInputRef.value
      if (el) {
        el.focus()
        const len = el.value.length
        try {
          el.setSelectionRange(len, len)
        } catch {
          // ignore
        }
      }
    })
    return
  }

  const before = lastKnownDeliveryCost.value
  const after = cartStore.deliveryCost
  if (after !== before) {
    deliveryChangeMessage.value = `Стоимость доставки изменилась: была ${formatPrice(
      before
    )}, теперь ${formatPrice(after)}.`
  }

  await handleCheckout()
  showAddressModal.value = false
}

async function handleCheckout() {
  if (!cartStore.items.length) return

  try {
    const body: any = {
      items: cartStore.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      address: {
        line: addressQuery.value || null,
        flat: flat.value || null,
        comment: comment.value || null,
        zone: deliveryZoneProps.value ?? null,
      },
    }

    // В Telegram Mini App передаём initData, чтобы бэкенд не требовал web-сессию
    if (isTelegram.value && webApp.value?.initData) {
      body.initData = webApp.value.initData
    }

    const res = await $fetch<{ ok: boolean; orderId?: string }>('/api/order', {
      method: 'POST',
      body,
    })

    if (res?.ok) {
      await saveCurrentAddress()
      cartStore.clear()
      cartStore.closeCartModal()
      lastOrderId.value = res.orderId ?? null
      showOrderSuccess.value = true
    } else if (process.client) {
      window.alert('Не удалось оформить заказ. Попробуйте ещё раз.')
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number }

    if (process.client && err?.statusCode === 401 && !isTelegram.value) {
      // Требуем веб-авторизацию только для классического сайта
      window.alert('Чтобы оформить заказ на сайте, сначала войдите через Telegram.')
    } else if (process.client) {
      window.alert('Ошибка при отправке заказа. Проверьте соединение.')
    }
  }
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}
</script>

<style scoped>
.cart-enter-active,
.cart-leave-active {
  transition: opacity 0.25s ease;
}
.cart-enter-active .relative,
.cart-leave-active .relative {
  transition: transform 0.25s ease;
}
.cart-enter-from,
.cart-leave-to {
  opacity: 0;
}
/* Мобильный боттомшит: выезжает снизу */
.cart-enter-from .relative,
.cart-leave-to .relative {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .cart-enter-from .relative,
  .cart-leave-to .relative {
    transform: scale(0.95);
  }
}

/* Модалка успеха заказа */
.success-enter-active,
.success-leave-active {
  transition: opacity 0.2s ease;
}
.success-enter-active .relative,
.success-leave-active .relative {
  transition: transform 0.2s ease;
}
.success-enter-from,
.success-leave-to {
  opacity: 0;
}
.success-enter-from .relative,
.success-leave-to .relative {
  transform: scale(0.9);
}
</style>
