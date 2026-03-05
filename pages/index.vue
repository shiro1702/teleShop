<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white fixed top-0 w-full">
      <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div class="flex items-center justify-between gap-4">
          <NuxtLink to="/" class="flex shrink-0 items-center gap-3">
            <img
              src="/image_112x112.png"
              alt="Логотип"
              class="h-10 w-10 rounded-full object-cover"
            />
            <h1 class="text-xl font-bold text-gray-900">Меню</h1>
          </NuxtLink>
          <nav class="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
            <a
              v-for="section in cartStore.productsByCategory"
              :key="section.category"
              :href="`#${section.category}`"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              {{ section.label }}
            </a>
          </nav>
          <NuxtLink
            to="/cart"
            class="flex shrink-0 items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
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
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 pt-24">
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
