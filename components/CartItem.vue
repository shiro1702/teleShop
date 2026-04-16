<template>
  <li
    class="relative flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4"
    :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBgColor }"
    :class="{ 'opacity-60': !!pendingRemoval }"
  >
    <div
      v-if="pendingRemoval"
      class="absolute inset-0 z-20 flex flex-col justify-center gap-2 rounded-lg bg-white/80 px-5 sm:px-6"
    >
      <div class="flex items-center gap-3">
        <div class="h-2.5 flex-1 overflow-hidden rounded-full" :style="{ backgroundColor: borderColor }">
          <div class="h-full bg-primary transition-all duration-100" :style="{ width: `${pendingProgress}%` }" />
        </div>
        <button type="button" class="shrink-0 text-xs font-semibold text-primary" @click="cartStore.cancelPendingRemoval(item.cartItemId)">
          Отменить
        </button>
      </div>
      <span class="text-xs" :style="{ color: mainTextColor }">Удаление через {{ pendingSecondsLeft }} c</span>
    </div>
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
        <button
          type="button"
          class="px-1 py-1 text-sm font-medium text-primary transition hover:underline"
          @click="emit('edit', item)"
        >
          Изменить
        </button>
        <div
          class="flex items-center rounded-lg border"
          :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: pageBgColor }"
        >
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-l-lg transition disabled:opacity-40"
            :style="{ color: mainTextColor }"
            aria-label="Уменьшить"
            @click="handleDecrease"
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
            @click="handleIncrease"
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
          class="hidden h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-red-600 transition hover:bg-red-50 hover:text-red-700 sm:inline-flex"
          aria-label="Удалить"
          @click="cartStore.scheduleItemRemoval(item.cartItemId, 5000)"
        >
          ×
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRefs } from 'vue'
import type { CartItem } from '~/stores/cart'
import { useCartStore } from '~/stores/cart'
import { useTenant } from '~/composables/useTenant'

const props = defineProps<{
  item: CartItem
}>()
const { item } = toRefs(props)
const emit = defineEmits<{
  (e: 'edit', item: CartItem): void
}>()

const cartStore = useCartStore()
const { tenant } = useTenant()

const theme = computed(() => tenant.value.theme || {})
const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')
const nowTick = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const pendingRemoval = computed(() => cartStore.pendingRemovalById(props.item.cartItemId))
const pendingProgress = computed(() => {
  const pending = pendingRemoval.value
  if (!pending) return 0
  const elapsed = Math.max(0, nowTick.value - pending.startedAt)
  return Math.max(0, Math.min(100, Math.round((elapsed / pending.durationMs) * 100)))
})
const pendingSecondsLeft = computed(() => {
  const pending = pendingRemoval.value
  if (!pending) return 0
  return Math.max(0, Math.ceil((pending.expiresAt - nowTick.value) / 1000))
})

function handleDecrease() {
  if (props.item.quantity <= 1) {
    cartStore.scheduleItemRemoval(props.item.cartItemId, 5000)
    return
  }
  cartStore.updateQuantity(props.item.cartItemId, props.item.quantity - 1)
}

function handleIncrease() {
  cartStore.cancelPendingRemoval(props.item.cartItemId)
  cartStore.addItem(props.item, 1, props.item.selectedModifiers, props.item.selectedParameters)
}

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

onMounted(() => {
  ticker = setInterval(() => {
    nowTick.value = Date.now()
  }, 100)
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
})
</script>
