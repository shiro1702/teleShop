<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div class="flex items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-3 text-gray-600 transition hover:text-gray-900">
            <img
              src="/logo.webp"
              alt="Логотип"
              class="h-10 w-10 rounded-full object-cover"
            />
            <span>← Назад в магазин</span>
          </NuxtLink>
          <div class="text-right">
            <h1 class="text-xl font-bold text-gray-900">Корзина</h1>
            <p v-if="cartStore.count > 0" class="text-sm text-[#2563eb]">
              {{ cartStore.count }} шт. · {{ formatPrice(cartStore.total) }}
            </p>
          </div>
          <span class="w-24" />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div v-if="cartStore.items.length === 0" class="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p class="text-gray-500">Корзина пуста</p>
        <NuxtLink
          to="/"
          class="mt-4 inline-block rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8]"
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
            @remove="cartStore.removeItem(item.id)"
          />
        </ul>

        <div class="mt-8 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-gray-900">Итого:</span>
            <span class="text-xl font-bold text-[#2563eb]">
              {{ formatPrice(cartStore.total) }}
            </span>
          </div>
          <div class="flex justify-end">
            <button
              type="button"
              class="text-sm text-gray-500 transition hover:text-red-600"
              @click="confirmClearCart"
            >
              Очистить корзину
            </button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
const cartStore = useCartStore()

function isClient() {
  return typeof window !== 'undefined'
}

function confirmClearCart() {
  if (!cartStore.items.length) return
  if (isClient()) {
    const ok = window.confirm('Очистить корзину?')
    if (!ok) return
  }
  cartStore.clear()
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}
</script>
