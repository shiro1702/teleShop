<template>
  <article
    class="flex h-full w-full cursor-pointer flex-col rounded-xl border overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    :class="isTelegram ? 'shadow-sm' : 'border-gray-200 bg-white shadow-sm'"
    :style="isTelegram ? {
      backgroundColor: 'var(--tg-theme-bg-color)',
      borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))',
      color: 'var(--tg-theme-text-color)'
    } : {}"
    @click="emit('open', product)"
  >
    <div
      class="aspect-square w-full shrink-0 overflow-hidden"
      :class="isTelegram ? '' : 'bg-gray-100'"
      :style="isTelegram ? { backgroundColor: 'var(--tg-theme-secondary-bg-color, #111)' } : {}"
    >
      <img
        :src="product.image"
        :alt="product.name"
        class="h-full w-full object-cover"
        @error="onImageError"
      />
    </div>
    <div class="flex min-h-0 flex-1 flex-col p-4">
      <div class="min-h-0 flex-1">
        <h3
          class="font-semibold line-clamp-2"
          :class="isTelegram ? '' : 'text-gray-900'"
        >
          {{ product.name }}
        </h3>
        <p
          v-if="product.description"
          class="mt-2 text-sm line-clamp-3"
          :class="isTelegram ? 'text-[var(--tg-theme-hint-color, #999)]' : 'text-gray-500'"
        >
          {{ product.description }}
        </p>
      </div>
      <div class="mt-3 shrink-0 space-y-3">
        <p
          class="text-lg font-medium"
          :style="isTelegram ? { color: 'var(--tg-theme-button-color)' } : { color: '#2563eb' }"
        >
          {{ formatPrice(product.price) }}
        </p>

        <!-- Товар не в корзине — одна кнопка -->
        <button
          v-if="quantity === 0"
          type="button"
          class="w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition"
          :style="isTelegram
            ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }
            : { backgroundColor: '#2563eb' }"
          @click.stop="cartStore.addItem(product)"
        >
          В корзину
        </button>

        <!-- Товар в корзине — счётчик и кнопки +/- -->
        <div
          v-else
          class="flex items-center justify-center gap-1 rounded-lg border p-1"
          :class="isTelegram ? '' : 'border-gray-200 bg-gray-50'"
          :style="isTelegram ? {
            borderColor: 'var(--tg-theme-section-separator-color, rgba(0,0,0,0.08))',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(0,0,0,0.02))'
          } : {}"
        >
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 transition"
            :class="isTelegram ? 'bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] ring-[var(--tg-theme-section-separator-color,rgba(0,0,0,0.08))]' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'"
            aria-label="Убавить"
            @click.stop="cartStore.updateQuantity(product.id, quantity - 1)"
          >
            −
          </button>
          <span
            class="grow min-w-[2rem] text-center text-sm font-medium"
            :class="isTelegram ? '' : 'text-gray-900'"
          >
            {{ quantity }}
          </span>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white transition"
            :style="isTelegram
              ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }
              : { backgroundColor: '#2563eb' }"
            aria-label="Добавить"
            @click.stop="cartStore.addItem(product)"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Product } from '~/data/products'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  (e: 'open', product: Product): void
}>()

const cartStore = useCartStore()
const { isTelegram } = useTelegram()
const quantity = computed(() => cartStore.quantityById(props.product.id))

function formatPrice(price: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price)
}

function onImageError(e: Event) {
  const target = e.target as HTMLImageElement
  target.src = 'https://placehold.co/400x400/e5e7eb/9ca3af?text=Нет+фото'
}
</script>
