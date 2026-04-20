<template>
  <section v-if="items.length > 0" class="rounded-2xl border p-4" :style="containerStyle">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold" :style="{ color: mainTextColor }">
          Добавьте к заказу
        </h3>
        <p class="text-xs" :style="{ color: mutedTextColor }">
          {{ hintText }}
        </p>
      </div>
    </div>

    <div
      class="overflow-hidden touch-pan-y select-none cursor-grab active:cursor-grabbing"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerCancel"
    >
      <div class="flex gap-3 pb-1 transition-transform duration-300 ease-out" :style="trackStyle">
      <article
        v-for="item in items"
        :key="item.id"
        class="w-36 shrink-0 rounded-xl border p-2"
        :style="{ borderColor }"
      >
        <img
          :src="item.image || '/icons/favicon.svg'"
          :alt="item.name"
          class="h-20 w-full rounded-lg object-cover"
          loading="lazy"
        >
        <p class="mt-2 line-clamp-2 min-h-10 text-xs font-medium" :style="{ color: mainTextColor }">
          {{ item.name }}
        </p>
        <div class="mt-2 flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-primary">{{ formatPrice(item.price) }}</span>
          <button
            type="button"
            class="inline-flex min-w-[82px] items-center justify-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-on-primary transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="isItemLoading(item.id)"
            @click="$emit('add', item)"
          >
            <span
              v-if="isItemLoading(item.id)"
              class="mr-1 inline-block h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white"
            />
            {{ isItemLoading(item.id) ? 'Добавляем...' : 'Добавить' }}
          </button>
        </div>
      </article>
      </div>
    </div>
    <div v-if="items.length > 1" class="mt-2 flex items-center justify-center gap-1.5">
      <button
        v-for="(_, index) in items"
        :key="index"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="index === activeIndex ? 'w-5 bg-primary' : 'w-1.5'"
        :style="index === activeIndex ? undefined : { backgroundColor: borderColor }"
        :aria-label="`Показать рекомендацию ${index + 1}`"
        @click="setActiveIndex(index)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
export type UpsellItemView = {
  id: string
  name: string
  price: number
  image: string
  category: string
}

const props = withDefaults(defineProps<{
  items: UpsellItemView[]
  loadingItemIds?: string[]
  borderColor?: string
  mainTextColor?: string
  mutedTextColor?: string
  remainingRub?: number | null
}>(), {
  loadingItemIds: () => [],
  borderColor: 'var(--color-border-soft)',
  mainTextColor: 'var(--color-text-primary)',
  mutedTextColor: 'var(--color-text-muted)',
  remainingRub: null,
})

defineEmits<{
  (e: 'add', item: UpsellItemView): void
}>()

const activeIndex = ref(0)
const pointerStartX = ref<number | null>(null)
const SLIDE_WIDTH_PX = 144
const SLIDE_GAP_PX = 12
const SWIPE_THRESHOLD_PX = 36

const containerStyle = computed(() => ({
  borderColor: props.borderColor,
}))

const maxIndex = computed(() => Math.max(0, props.items.length - 1))
const slideStepPx = SLIDE_WIDTH_PX + SLIDE_GAP_PX
const trackStyle = computed(() => ({
  transform: `translateX(-${activeIndex.value * slideStepPx}px)`,
}))

const hintText = computed(() => {
  if (typeof props.remainingRub === 'number' && Number.isFinite(props.remainingRub) && props.remainingRub > 0) {
    return `До бесплатной доставки осталось ${formatPrice(props.remainingRub)}`
  }
  return 'С этим заказом часто берут'
})

watch(() => props.items.length, () => {
  if (activeIndex.value > maxIndex.value) {
    activeIndex.value = maxIndex.value
  }
})

function setActiveIndex(index: number): void {
  activeIndex.value = Math.max(0, Math.min(maxIndex.value, index))
}

function onPointerDown(event: PointerEvent): void {
  pointerStartX.value = event.clientX
}

function onPointerUp(event: PointerEvent): void {
  const startX = pointerStartX.value
  pointerStartX.value = null
  const endX = event.clientX
  if (typeof startX !== 'number' || typeof endX !== 'number') return
  const deltaX = endX - startX
  if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
  if (deltaX < 0) {
    setActiveIndex(activeIndex.value + 1)
    return
  }
  setActiveIndex(activeIndex.value - 1)
}

function onPointerCancel(): void {
  pointerStartX.value = null
}

function isItemLoading(itemId: string): boolean {
  return props.loadingItemIds.includes(itemId)
}

function formatPrice(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`
}
</script>
