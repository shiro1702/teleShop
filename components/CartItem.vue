<template>
  <li
    class="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4"
    :class="isTelegram ? '' : 'border-gray-200 bg-white'"
    :style="isTelegram ? {
      backgroundColor: 'var(--tg-theme-bg-color)',
      borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))',
      color: 'var(--tg-theme-text-color)'
    } : {}"
  >
    <div class="flex gap-3 sm:flex-1 sm:min-w-0">
      <div
        class="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
        :class="isTelegram ? '' : 'bg-gray-100'"
        :style="isTelegram ? { backgroundColor: 'var(--tg-theme-secondary-bg-color, #111)' } : {}"
      >
        <img
          :src="item.image"
          :alt="item.name"
          class="h-full w-full object-cover"
          @error="onImageError"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h3
          class="font-medium truncate"
          :class="isTelegram ? '' : 'text-gray-900'"
        >
          {{ item.name }}
        </h3>
        <p
          class="text-sm"
          :style="isTelegram ? { color: 'var(--tg-theme-button-color)' } : { color: '#2563eb' }"
        >
          {{ formatPrice(item.price) }} за шт.
        </p>
      </div>
    </div>
    <!-- Панель: количество и кнопки +/- -->
    <div
      class="flex items-center justify-between gap-4 border-t pt-3 sm:border-0 sm:pt-0"
      :class="isTelegram ? '' : 'border-gray-100'"
      :style="isTelegram ? { borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))' } : {}"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex items-center rounded-lg border"
          :class="isTelegram ? '' : 'border-gray-200 bg-gray-50'"
          :style="isTelegram ? {
            borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.02))'
          } : {}"
        >
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-l-lg transition disabled:opacity-40"
            :class="isTelegram ? 'text-[var(--tg-theme-hint-color,#999)] hover:bg-[var(--tg-theme-secondary-bg-color)]' : 'text-gray-600 hover:bg-gray-200'"
            aria-label="Уменьшить"
            :disabled="item.quantity <= 1"
            @click="cartStore.updateQuantity(item.id, item.quantity - 1)"
          >
            −
          </button>
          <span
            class="min-w-[2.5rem] text-center text-sm font-medium text-gray-900"
            :class="isTelegram ? '' : 'text-gray-900'"
            aria-live="polite"
          >
            {{ item.quantity }}
          </span>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-r-lg text-white transition"
            :style="isTelegram
              ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }
              : { backgroundColor: '#2563eb' }"
            aria-label="Увеличить"
            @click="cartStore.addItem(item, 1)"
          >
            +
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <p
          class="font-semibold"
          :class="isTelegram ? '' : 'text-gray-900'"
        >
          {{ formatPrice(item.price * item.quantity) }}
        </p>
        <button
          type="button"
          class="rounded-lg px-2 py-1.5 text-sm transition"
          :class="isTelegram ? 'text-[var(--tg-theme-destructive-text-color, #e53935)] hover:bg-[var(--tg-theme-secondary-bg-color)]' : 'text-red-600 hover:bg-red-50 hover:text-red-700'"
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
const { isTelegram } = useTelegram()

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
