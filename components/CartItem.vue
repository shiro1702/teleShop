<template>
  <li
    class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-4"
  >
    <div class="flex gap-3 sm:flex-1 sm:min-w-0">
      <div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        <img
          :src="item.image"
          :alt="item.name"
          class="h-full w-full object-cover"
          @error="onImageError"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-medium text-gray-900 truncate">
          {{ item.name }}
        </h3>
        <p class="text-sm text-[#2563eb]">
          {{ formatPrice(item.price) }} за шт.
        </p>
      </div>
    </div>
    <!-- Панель: количество и кнопки +/- -->
    <div class="flex items-center justify-between gap-4 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
      <div class="flex items-center gap-2">
        <div class="flex items-center rounded-lg border border-gray-200 bg-gray-50">
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-l-lg text-gray-600 transition hover:bg-gray-200 disabled:opacity-40"
            aria-label="Уменьшить"
            :disabled="item.quantity <= 1"
            @click="cartStore.updateQuantity(item.id, item.quantity - 1)"
          >
            −
          </button>
          <span
            class="min-w-[2.5rem] text-center text-sm font-medium text-gray-900"
            aria-live="polite"
          >
            {{ item.quantity }}
          </span>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-r-lg bg-[#2563eb] text-white transition hover:bg-[#1d4ed8]"
            aria-label="Увеличить"
            @click="cartStore.addItem(item, 1)"
          >
            +
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <p class="font-semibold text-gray-900">
          {{ formatPrice(item.price * item.quantity) }}
        </p>
        <button
          type="button"
          class="rounded-lg px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50 hover:text-red-700"
          @click="cartStore.removeItem(item.id)"
        >
          Удалить
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { CartItem } from '~/stores/cart'

defineProps<{
  item: CartItem
}>()

const cartStore = useCartStore()

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

function onImageError(e: Event) {
  const target = e.target as HTMLImageElement
  target.src = 'https://placehold.co/96x96/e5e7eb/9ca3af?text=—'
}
</script>
