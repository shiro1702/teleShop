<template>
  <article
    class="flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBgColor }"
    @click="emit('open', product)"
  >
    <div class="aspect-square w-full shrink-0 overflow-hidden bg-gray-100 relative">
      <img
        :src="product.image"
        :alt="product.name"
        class="h-full w-full object-cover"
        @error="onImageError"
      />
      <div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
        <div v-if="quantity > 0" class="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          {{ quantity }} шт
        </div>
        <div v-if="(product.modifiers && product.modifiers.length > 0) || (product.parameters && product.parameters.length > 0)" class="rounded-full bg-white/90 backdrop-blur px-2 py-1 text-[10px] font-medium text-gray-700 shadow-sm">
          Настраиваемый
        </div>
      </div>
    </div>
    <div class="flex min-h-0 flex-1 flex-col p-4">
      <div class="min-h-0 flex-1">
        <h3 class="line-clamp-2 font-semibold" :style="{ color: mainTextColor }">
          {{ product.name }}
        </h3>
        <p v-if="product.description" class="mt-2 line-clamp-3 text-sm" :style="{ color: mutedTextColor }">
          {{ product.description }}
        </p>
      </div>
      <div class="mt-3 shrink-0 space-y-3">
        <p class="text-lg font-medium text-primary">
          {{ displayPrice }}
        </p>

        <!-- Если есть модификаторы или параметры, всегда показываем кнопку "Выбрать" (открывает модалку) -->
        <button
          v-if="(product.modifiers && product.modifiers.length > 0) || (product.parameters && product.parameters.length > 0)"
          type="button"
          class="w-full rounded-lg px-4 py-3 text-base font-medium transition"
          :style="{ backgroundColor: theme.primary_50 || '#f3f4f6', color: theme.primary_700 || '#111827' }"
          @click.stop="emit('open', product)"
        >
          Выбрать
        </button>

        <!-- Если нет модификаторов, стандартная логика корзины -->
        <template v-else>
          <button
            v-if="quantity === 0"
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-white transition hover:bg-primary-600 active:bg-primary-700"
            @click.stop="cartStore.addItem(product)"
          >
            В корзину
          </button>

          <div
            v-else
            class="flex items-center justify-center gap-1 rounded-lg border p-1"
            :style="{ borderColor: theme.primary_100 || '#e5e7eb' }"
          >
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition hover:bg-gray-100/10"
              :style="{ color: mainTextColor }"
              aria-label="Убавить"
              @click.stop="cartStore.decrementByProductId(product.id)"
            >
              −
            </button>
            <span class="grow min-w-[2rem] text-center text-base font-medium" :style="{ color: mainTextColor }">
              {{ quantity }}
            </span>
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white transition hover:opacity-90"
              aria-label="Добавить"
              @click.stop="cartStore.addItem(product)"
            >
              +
            </button>
          </div>
        </template>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '~/data/products'
import { useCartStore } from '~/stores/cart'
import { useTenant } from '~/composables/useTenant'

const props = defineProps<{
  product: Product
}>()

const emit = defineEmits<{
  (e: 'open', product: Product): void
}>()

const cartStore = useCartStore()
const { tenant } = useTenant()

const theme = computed(() => tenant.value.theme || {})
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')

// Для товаров без модификаторов cartItemId совпадает с product.id
const quantity = computed(() => cartStore.quantityByProductId(props.product.id))

const displayPrice = computed(() => {
  const hasModifiers = props.product.modifiers && props.product.modifiers.length > 0
  const hasParameters = props.product.parameters && props.product.parameters.length > 0

  if (!hasModifiers && !hasParameters) {
    return formatPrice(props.product.price)
  }
  
  let minPrice = props.product.price

  if (hasParameters) {
    // If we have parameters, the base price is the minimum of the parameter options
    const allPrices = props.product.parameters!.flatMap(p => p.options.filter(o => o.price !== undefined).map(o => o.price!))
    if (allPrices.length > 0) {
      minPrice = Math.min(...allPrices)
    }
  }

  if (hasModifiers) {
    for (const group of props.product.modifiers!) {
      if (group.isRequired && group.minSelect > 0) {
        const options = [...group.options]
        for (let i = 0; i < Math.min(group.minSelect, options.length); i++) {
          let bestIndex = -1
          let bestPrice = Number.POSITIVE_INFINITY
          for (let idx = 0; idx < options.length; idx++) {
            const opt = options[idx]
            const candidate =
              opt.pricingType === 'multiplier'
                ? Math.round(minPrice * (opt.priceMultiplier ?? 1))
                : minPrice + (opt.priceDelta || 0)
            if (candidate < bestPrice) {
              bestPrice = candidate
              bestIndex = idx
            }
          }
          if (bestIndex >= 0) {
            minPrice = bestPrice
            options.splice(bestIndex, 1)
          }
        }
      }
    }
  }
  return `от ${formatPrice(minPrice)}`
})

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
