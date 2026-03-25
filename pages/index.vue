<template>
  <div class="min-h-screen" :style="pageStyle">
    <div class="sticky top-16 z-40 backdrop-blur" :style="topBarStyle">
      <div class="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <nav class="-mx-4 flex flex-1 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <a
              v-for="section in cartStore.productsByCategory"
              :key="section.category"
              :href="`#${section.category}`"
            class="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary-50"
            :style="chipStyle"
            >
              {{ section.label }}
            </a>
          </nav>

          <button
            type="button"
            class="hidden shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700 sm:flex"
            @click="goToCheckout"
          >
            <span>Корзина</span>
            <template v-if="cartStore.count > 0">
              <span class="text-orange-100">
                {{ cartStore.count }} шт.
              </span>
              <span class="font-semibold text-white">
                {{ formatPrice(cartStore.total) }}
              </span>
            </template>
          </button>
        </div>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
      <section
        v-if="tenantDescription"
        class="mb-8 overflow-hidden rounded-3xl p-5 shadow-sm sm:p-6"
        :style="heroStyle"
      >
        <div class="flex items-start gap-4">
          <img
            :src="tenantLogoUrl"
            :alt="tenantName"
            class="h-16 w-16 shrink-0 rounded-2xl border border-white/80 bg-white object-cover shadow-sm"
          />
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {{ tenantName }}
            </p>
            <p class="mt-2 max-w-3xl text-sm leading-6 sm:text-base" :style="{ color: mutedTextColor }">
              {{ tenantDescription }}
            </p>
          </div>
        </div>
      </section>

      <section
        v-for="section in cartStore.productsByCategory"
        :key="section.category"
        :id="section.category"
        class="mb-10 scroll-mt-28"
      >
        <h2 class="mb-4 text-lg font-semibold" :style="{ color: mainTextColor }">
          {{ section.label }}
        </h2>
        <ul
          class="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
        >
          <li v-for="product in section.products" :key="product.id" class="flex">
            <ProductCard :product="product" @open="openProduct(product)" />
          </li>
        </ul>
      </section>
    </main>
    <!-- Модалка успеха заказа после возврата на меню -->
    <Teleport to="body">
      <Transition name="product">
        <div
          v-if="showOrderSuccess"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            :style="modalCardStyle"
          >
            <h2 class="text-lg font-bold" :style="{ color: mainTextColor }">
              Заказ оформлен!
            </h2>
            <p
              v-if="lastOrderId"
              class="mt-2 text-sm"
              :style="{ color: mutedTextColor }"
            >
              Номер заказа:
                <span class="font-semibold" :style="{ color: mainTextColor }">
                #{{ lastOrderId }}
              </span>
            </p>
            <p class="mt-2 text-sm" :style="{ color: mutedTextColor }">
              Мы пришлём обновления по заказу в Telegram.
            </p>
            <button
              type="button"
            class="mt-4 w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700"
              @click="showOrderSuccess = false"
            >
              Понятно
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- Нижняя панель корзины на мобильных -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-2 sm:hidden pb-10"
      :style="mobileBarStyle"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-lg bg-primary px-4 py-3 text-base font-medium text-white shadow-md"
        @click="goToCheckout"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Корзина</span>
        </div>
        <div v-if="cartStore.count > 0" class="flex items-center gap-2">
          <span class="text-sm text-orange-100">
            {{ cartStore.count }} шт.
          </span>
          <span class="text-sm font-semibold">
            {{ formatPrice(cartStore.total) }}
          </span>
        </div>
      </button>
    </div>
    <!-- Модалка с информацией о товаре -->
    <Teleport to="body">
      <Transition name="product">
        <div
          v-if="selectedProduct"
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            class="absolute inset-0"
            @click="closeProduct"
          />
          <div
            class="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-t-2xl shadow-xl sm:rounded-2xl"
            :style="modalCardStyle"
          >
            <button
              type="button"
              class="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
              aria-label="Закрыть"
              @click="closeProduct"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="h-48 w-full overflow-hidden sm:h-56" :style="{ backgroundColor: cardBgColor }">
              <img
                :src="selectedProduct.image"
                :alt="selectedProduct.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="space-y-3 p-4 sm:p-5">
              <h2 class="text-lg font-semibold sm:text-xl" :style="{ color: mainTextColor }">
                {{ selectedProduct.name }}
              </h2>
              <p
                v-if="selectedProduct.description"
                class="text-sm"
                :style="{ color: mutedTextColor }"
              >
                {{ selectedProduct.description }}
              </p>
              <p class="text-lg font-bold text-primary">
                {{ formatPrice(selectedProduct.price) }}
              </p>
              <button
                type="button"
              class="mt-2 w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700"
                @click="addSelectedToCart"
              >
                Добавить в корзину
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { $fetch } from 'ofetch'
import type { Product } from '../data/products'
import { useTenant } from '../composables/useTenant'
import { useTelegram } from '../composables/useTelegram'
import { useCartStore } from '../stores/cart'

const cartStore = useCartStore()
const { isTelegram } = useTelegram()
const router = useRouter()
const route = useRoute()
const { tenant, tenantKey, tenantPath } = useTenant()
const selectedProduct = ref<Product | null>(null)
const showOrderSuccess = ref(false)
const lastOrderId = ref<string | null>(null)
const isCatalogLoading = ref(false)
const tenantName = computed(() => tenant.value.shopName || 'Наш магазин')
const tenantLogoUrl = computed(() => tenant.value.logoUrl || '/logo.webp')
const tenantDescription = computed(() => tenant.value.description || '')
const theme = computed(() => tenant.value.theme || {})

const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')

const pageStyle = computed(() => ({
  backgroundColor: pageBgColor.value,
  color: mainTextColor.value,
}))

const topBarStyle = computed(() => ({
  backgroundColor: cardBgColor.value,
  borderBottom: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
}))

const chipStyle = computed(() => ({
  border: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
  backgroundColor: cardBgColor.value,
  color: mutedTextColor.value,
}))

const heroStyle = computed(() => ({
  border: `1px solid ${theme.value.primary_100 || '#e5e7eb'}`,
  backgroundColor: cardBgColor.value,
}))

const modalCardStyle = computed(() => ({
  backgroundColor: cardBgColor.value,
  color: mainTextColor.value,
}))

const mobileBarStyle = computed(() => ({
  borderColor: theme.value.primary_100 || '#e5e7eb',
  backgroundColor: cardBgColor.value,
}))

function applyCartScope() {
  const scope = typeof tenantKey.value === 'string' && tenantKey.value.trim()
    ? tenantKey.value.trim()
    : null
  cartStore.setScope(scope)
}

function openProduct(product: Product) {
  selectedProduct.value = product
}

function closeProduct() {
  selectedProduct.value = null
}

function addSelectedToCart() {
  if (!selectedProduct.value) return
  cartStore.addItem(selectedProduct.value, 1)
  selectedProduct.value = null
}

function goToCheckout() {
  router.push(tenantPath('/cart'))
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

onMounted(() => {
  applyCartScope()
  void loadCatalog()
  const orderId = route.query.orderId
  if (typeof orderId === 'string' && orderId) {
    lastOrderId.value = orderId
    showOrderSuccess.value = true
    router.replace({ path: route.path, query: { ...route.query, orderId: undefined } })
  }
})

watch(tenantKey, () => {
  applyCartScope()
  void loadCatalog()
})

async function loadCatalog() {
  if (isCatalogLoading.value) return
  isCatalogLoading.value = true
  try {
    const res = await $fetch<{ ok: boolean; items: Product[] }>('/api/products', {
      query: tenantKey.value ? { shop_id: tenantKey.value } : undefined,
      headers: tenantKey.value ? { 'x-shop-id': tenantKey.value } : undefined,
    })
    if (res?.ok && Array.isArray(res.items)) {
      cartStore.setProducts(res.items)
    }
  } catch {
    // fallback remains in store (MOCK_PRODUCTS) for local/dev compatibility
    cartStore.hydrateFromStorage()
  } finally {
    isCatalogLoading.value = false
  }
}

</script>

<style scoped>
.product-enter-active,
.product-leave-active {
  transition: opacity 0.25s ease;
}
.product-enter-active .max-w-md,
.product-leave-active .max-w-md {
  transition: transform 0.25s ease;
}
.product-enter-from,
.product-leave-to {
  opacity: 0;
}
/* Мобильная модалка: выезжает снизу; на больших экранах лёгкий scale аналогичен корзине */
.product-enter-from .max-w-md,
.product-leave-to .max-w-md {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .product-enter-from .max-w-md,
  .product-leave-to .max-w-md {
    transform: scale(0.95);
  }
}
</style>
