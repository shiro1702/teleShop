<template>
  <li
    class="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4"
    :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBgColor }"
  >
    <div class="flex gap-3 sm:flex-1 sm:min-w-0">
      <div
        class="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"
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
          class="truncate font-medium"
          :style="{ color: mainTextColor }"
        >
          {{ item.name }}
        </h3>
        <p
          class="text-base text-primary"
        >
          {{ formatPrice(item.unitPrice) }} за шт.
        </p>
        
        <!-- Выбранные параметры -->
        <div v-if="item.selectedParameters && item.selectedParameters.length > 0" class="mt-1 flex flex-wrap gap-1">
          <span 
            v-for="param in item.selectedParameters" 
            :key="param.optionId"
            class="text-sm font-medium"
            :style="{ color: mainTextColor, opacity: 0.8 }"
          >
            {{ param.optionName }}<template v-if="param.weightG"> ({{ param.weightG }} г)</template><template v-if="param.volumeMl"> ({{ param.volumeMl }} мл)</template><template v-if="param.pieces"> ({{ param.pieces }} шт)</template>
          </span>
        </div>

        <!-- Выбранные модификаторы -->
        <div v-if="item.selectedModifiers && item.selectedModifiers.length > 0" class="mt-1 flex flex-wrap gap-1">
          <span 
            v-for="mod in item.selectedModifiers" 
            :key="mod.optionId"
            class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
            :style="{ borderColor: theme.primary_100 || '#e5e7eb', color: mainTextColor }"
          >
            {{ mod.optionName }}
          </span>
        </div>
      </div>
    </div>
    <!-- Панель: количество и кнопки +/- -->
    <div
      class="flex items-center justify-between gap-4 border-t pt-3 sm:border-0 sm:pt-0"
      :style="{ borderColor: theme.primary_100 || '#e5e7eb' }"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex items-center rounded-lg border"
          :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: pageBgColor }"
        >
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-l-lg transition disabled:opacity-40"
            :style="{ color: mainTextColor }"
            aria-label="Уменьшить"
            @click="cartStore.updateQuantity(item.cartItemId, item.quantity - 1)"
          >
            −
          </button>
          <span
            class="min-w-[2.5rem] text-center text-base font-medium"
            :style="{ color: mainTextColor }"
            aria-live="polite"
          >
            {{ item.quantity }}
          </span>
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-r-lg bg-primary text-white transition hover:bg-primary-600 active:bg-primary-700"
            aria-label="Увеличить"
            @click="cartStore.addItem(item, 1, item.selectedModifiers, item.selectedParameters)"
          >
            +
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <p
          class="font-semibold"
          :style="{ color: mainTextColor }"
        >
          {{ formatPrice(item.unitPrice * item.quantity) }}
        </p>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-base text-red-600 transition hover:bg-red-50 hover:text-red-700"
          @click="cartStore.removeItem(item.cartItemId)"
        >
          Удалить
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CartItem } from '~/stores/cart'
import { useCartStore } from '~/stores/cart'
import { useTenant } from '~/composables/useTenant'

defineProps<{
  item: CartItem
}>()

const cartStore = useCartStore()
const { tenant } = useTenant()

const theme = computed(() => tenant.value.theme || {})
const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')

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
