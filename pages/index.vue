<template>
  <div class="min-h-screen bg-gray-50">
    <header class="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div class="mx-auto max-w-6xl px-4 py-3 sm:py-4 sm:px-6">
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-2 md:flex-initial">
            <!-- Бургер только на мобильных -->
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 md:hidden"
              aria-label="Открыть меню"
              aria-expanded="isNavOpen"
              @click="isNavOpen = true"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <NuxtLink to="/" class="flex shrink-0 items-center gap-2 gap-3 sm:gap-3">
              <img
                src="/image_112x112.png"
                alt="Логотип"
                class="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
              />
              <h1 class="truncate text-lg font-bold text-gray-900 sm:text-xl">Меню</h1>
            </NuxtLink>
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
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 sm:gap-2 sm:px-4"
            @click="cartStore.openCartModal()"
          >
            <span class="hidden xs:inline">Корзина</span>
            <svg class="h-5 w-5 sm:hidden" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
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
            @click="isNavOpen = false"
          />
          <div class="absolute inset-x-0 top-0 rounded-b-2xl bg-white p-4 shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <span class="font-semibold text-gray-900">Разделы меню</span>
              <button
                type="button"
                class="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
                aria-label="Закрыть меню"
                @click="isNavOpen = false"
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
                @click="isNavOpen = false"
              >
                {{ section.label }}
              </a>
            </nav>
          </div>
        </div>
      </Transition>
    </Teleport>

    <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <li v-for="product in section.products" :key="product.id" class="flex">
            <ProductCard :product="product" />
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
const cartStore = useCartStore()

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

</script>
