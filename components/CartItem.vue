<template>
  <li
    class="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4"
  >
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
        {{ formatPrice(item.price) }} × {{ item.quantity }}
      </p>
    </div>
    <div class="shrink-0 text-right">
      <p class="font-semibold text-gray-900">
        {{ formatPrice(item.price * item.quantity) }}
      </p>
      <button
        type="button"
        class="mt-1 text-sm text-red-600 hover:text-red-700"
        @click="$emit('remove')"
      >
        Удалить
      </button>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { CartItem } from '~/stores/cart'

defineProps<{
  item: CartItem
}>()

defineEmits<{
  remove: []
}>()

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
