<template>
  <article
    class="overflow-hidden rounded-2xl border"
    :style="{
      borderColor: tokens.brandSecondary,
      backgroundColor: tokens.surfaceCard,
      color: tokens.textPrimary,
      borderRadius: `${radii.card}px`,
    }"
  >
    <div class="aspect-square w-full bg-gray-100">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Product"
        class="h-full w-full object-cover"
      >
      <div v-else class="flex h-full items-center justify-center text-xs text-gray-500">Нет фото товара</div>
    </div>
    <div class="space-y-2 p-4">
      <h3 class="line-clamp-2 text-sm font-semibold">{{ title || 'Карточка товара' }}</h3>
      <p class="line-clamp-2 text-xs" :style="{ color: tokens.textMuted }">
        {{ description || 'Описание товара и визуальные стили кнопок в превью.' }}
      </p>
      <div class="flex items-center justify-between">
        <span class="text-base font-semibold" :style="{ color: tokens.brandPrimary }">{{ priceLabel }}</span>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium text-white"
          :style="{ backgroundColor: tokens.brandPrimary, borderRadius: `${radii.button}px` }"
        >
          В корзину
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrganizationStyleConfig } from '../../types/organization-style'

const props = defineProps<{
  title: string
  description: string
  imageUrl: string
  price: number
  styleConfig: Pick<OrganizationStyleConfig, 'tokens' | 'radii'>
}>()

const tokens = computed(() => props.styleConfig.tokens)
const radii = computed(() => props.styleConfig.radii)
const priceLabel = computed(() => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(props.price || 390))
</script>
