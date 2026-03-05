<template>
  <article
    class="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden transition hover:shadow-md"
  >
    <div class="aspect-square w-full shrink-0 overflow-hidden bg-gray-100">
      <img
        :src="product.image"
        :alt="product.name"
        class="h-full w-full object-cover"
        @error="onImageError"
      />
    </div>
    <div class="flex min-h-0 flex-1 flex-col p-4">
      <div class="min-h-0 flex-1">
        <h3 class="font-semibold text-gray-900 line-clamp-2">
          {{ product.name }}
        </h3>
        <p
          v-if="product.description"
          class="mt-2 text-sm text-gray-500 line-clamp-3"
        >
          {{ product.description }}
        </p>
      </div>
      <div class="mt-3 shrink-0 space-y-3">
        <p class="text-lg font-medium text-[#2563eb]">
          {{ formatPrice(product.price) }}
        </p>

        <!-- Товар не в корзине — одна кнопка -->
        <button
          v-if="quantity === 0"
          type="button"
          class="w-full rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:bg-[#1e40af]"
          @click="cartStore.addItem(product)"
        >
          В корзину
        </button>

        <!-- Товар в корзине — счётчик и кнопки +/- -->
        <div
          v-else
          class="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
        >
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
            aria-label="Убавить"
            @click="cartStore.updateQuantity(product.id, quantity - 1)"
          >
            −
          </button>
          <span class="grow min-w-[2rem] text-center text-sm font-medium text-gray-900">
            {{ quantity }}
          </span>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2563eb] text-white transition hover:bg-[#1d4ed8]"
            aria-label="Добавить"
            @click="cartStore.addItem(product)"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Product } from '~/stores/cart'

const props = defineProps<{
  product: Product
}>()

const cartStore = useCartStore()
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
