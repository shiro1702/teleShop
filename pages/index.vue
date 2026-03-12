<template>
  <div
    class="min-h-screen"
    :style="isTelegram ? {
      minHeight: 'var(--tg-viewport-height)',
      backgroundColor: 'var(--tg-theme-bg-color)',
      color: 'var(--tg-theme-text-color)'
    } : {}"
  >
    <header
      class="sticky top-0 z-40 border-b"
      :style="isTelegram ? {
        backgroundColor: 'var(--tg-theme-header-bg-color, var(--tg-theme-bg-color))',
        color: 'var(--tg-theme-text-color)',
        borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))'
      } : {}"
    >
      <div class="mx-auto max-w-6xl px-4 py-3 sm:py-4 sm:px-6"
        :style="isTelegram ? {
          backgroundColor: 'var(--tg-theme-header-bg-color, var(--tg-theme-bg-color))',
          color: 'var(--tg-theme-text-color)',
          borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))'
        } : {}"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 flex-1 items-center justify-center gap-2 md:flex-initial">
            <NuxtLink to="/" class="flex shrink-0 items-center gap-2 gap-3 sm:gap-3">
              <img
                src="/image_112x112.png"
                alt="Логотип"
                class="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
              />
              <h1 class="truncate text-lg font-bold text-gray-900 sm:text-xl">Меню</h1>
            </NuxtLink>
            <!-- Бургер только на мобильных -->
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 md:hidden"
              aria-label="Открыть меню"
              aria-expanded="isNavOpen"
              @click="openNav"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <nav class="hidden flex-wrap items-center justify-center gap-1 md:flex md:gap-2">
            <a
              v-for="section in cartStore.productsByCategory"
              :key="section.category"
              :href="`#${section.category}`"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              {{ section.label }}
            </a>
          </nav>
          <!-- Кнопка корзины в шапке — только на планшетах и десктопе -->
          <button
            type="button"
            class="hidden shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 sm:gap-2 sm:px-4 md:flex"
            @click="cartStore.openCartModal()"
          >
            <span>Корзина</span>
            <template v-if="cartStore.count > 0">
              <span class="text-gray-500">
                {{ cartStore.count }} шт.
              </span>
              <span class="font-semibold text-[#2563eb]">
                {{ formatPrice(cartStore.total) }}
              </span>
            </template>
          </button>
        </div>
      </div>
    </header>

    <!-- Мобильное меню (оверлей + список разделов) -->
    <Teleport to="body">
      <Transition name="nav">
        <div
          v-if="isNavOpen"
          class="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Меню разделов"
        >
          <div
            class="absolute inset-0 bg-black/50"
            @click="closeNav"
          />
          <div class="absolute inset-x-0 top-0 rounded-b-2xl bg-white p-4 shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <span class="font-semibold text-gray-900">Разделы меню</span>
              <button
                type="button"
                class="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
                aria-label="Закрыть меню"
                @click="closeNav"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav class="flex flex-col gap-1 pt-3">
              <a
                v-for="section in cartStore.productsByCategory"
                :key="section.category"
                :href="`#${section.category}`"
                class="rounded-lg px-3 py-3 text-left text-base font-medium text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
                @click="closeNav"
              >
                {{ section.label }}
              </a>
            </nav>
          </div>
        </div>
      </Transition>
    </Teleport>

    <main class="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
      <section
        v-for="section in cartStore.productsByCategory"
        :key="section.category"
        :id="section.category"
        class="mb-10 scroll-mt-4"
      >
        <h2 class="mb-4 text-lg font-semibold text-gray-800">
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
    <!-- Нижняя панель корзины на мобильных -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 py-2 sm:hidden"
      :class="isTelegram ? 'pb-20': ''"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md"
        :style="isTelegram ? {
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)'
        } : { backgroundColor: '#2563eb' }"
        @click="cartStore.openCartModal()"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Корзина</span>
        </div>
        <div v-if="cartStore.count > 0" class="flex items-center gap-2">
          <span class="text-xs text-blue-100">
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
            class="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
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
            <div class="h-48 w-full overflow-hidden bg-gray-100 sm:h-56">
              <img
                :src="selectedProduct.image"
                :alt="selectedProduct.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="space-y-3 p-4 sm:p-5">
              <h2 class="text-lg font-semibold text-gray-900 sm:text-xl">
                {{ selectedProduct.name }}
              </h2>
              <p
                v-if="selectedProduct.description"
                class="text-sm text-gray-600"
              >
                {{ selectedProduct.description }}
              </p>
              <p class="text-lg font-bold text-[#2563eb]">
                {{ formatPrice(selectedProduct.price) }}
              </p>
              <button
                type="button"
                class="mt-2 w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
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
const cartStore = useCartStore()
const { isTelegram } = useTelegram()
const isNavOpen = ref(false)
const selectedProduct = ref<import('~/data/products').Product | null>(null)

function openNav() {
  isNavOpen.value = true
}
function closeNav() {
  isNavOpen.value = false
}

function openProduct(product: import('~/data/products').Product) {
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

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
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
