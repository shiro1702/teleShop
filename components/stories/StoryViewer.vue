<template>
  <Teleport to="body">
    <div
      v-if="campaign && modelValue"
      class="fixed inset-0 z-[100] flex flex-col bg-black/80"
      role="dialog"
      aria-modal="true"
    >

      <div class="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        <div class="relative h-full w-full max-h-[780px] max-w-[400px]">

          <button
            type="button"
            class="absolute right-1 top-1 z-20 rounded-full bg-black/55 p-2 text-white shadow-sm sm:-right-12 sm:-top-0"
            aria-label="Закрыть"
            @click.stop="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            class="relative flex h-full w-full max-h-[780px] max-w-[400px] overflow-hidden rounded-3xl bg-black"
            @click="onTapContent"
          >
            <template v-if="currentSlide">
              <img
                v-if="isImageUrl(currentSlide.mediaUrl)"
                :src="currentSlide.mediaUrl"
                :alt="campaign.title"
                class="h-full w-full object-cover"
              >
              <video
                v-else
                :key="currentSlide.id"
                ref="videoRef"
                class="h-full w-full object-cover"
                :src="currentSlide.mediaUrl"
                autoplay
                playsinline
                @ended="onVideoEnded"
              />
            </template>

            <div
              v-if="currentSlide && currentSlide.actionType !== 'none'"
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-16 sm:px-4 sm:pb-4"
            >
              <button
                type="button"
                class="w-full rounded-xl bg-white py-3 text-base font-semibold text-gray-900"
                @click.stop="onActionClick"
              >
                {{ actionLabel }}
              </button>
            </div>
            <div class="absolute top-0 right-0 left-0 z-20 flex shrink-0 gap-1 p-4">
              <div
                v-for="(_, i) in campaign.slides"
                :key="i"
                class="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
              >
                <div
                  class="h-full bg-white transition-[width] duration-100 ease-linear"
                  :style="{ width: progressWidth(i) }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { $fetch } from 'ofetch'
import type { StoryCampaignDto, StorySlideDto } from '~/types/stories'

const props = defineProps<{
  campaign: StoryCampaignDto | null
  shopId: string | null
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'action', payload: { slide: StorySlideDto; actionType: string }): void
}>()

const slideIndex = ref(0)
const tick = ref(0)
const videoRef = ref<HTMLVideoElement | null>(null)

let tickTimer: ReturnType<typeof setInterval> | null = null
let advanceTimer: ReturnType<typeof setTimeout> | null = null
const recordedSlides = new Set<string>()

const currentSlide = computed<StorySlideDto | null>(() => {
  const c = props.campaign
  if (!c?.slides?.length) return null
  const i = Math.min(slideIndex.value, c.slides.length - 1)
  return c.slides[i] ?? null
})

const actionLabel = computed(() => {
  const t = currentSlide.value?.actionType
  if (t === 'add_to_cart') return 'В корзину'
  if (t === 'apply_promo') return 'Применить промокод'
  if (t === 'open_category') return 'К категории'
  return 'Далее'
})

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || url.includes('/image')
}

function progressWidth(i: number): string {
  const c = props.campaign
  if (!c?.slides?.length) return '0%'
  if (i < slideIndex.value) return '100%'
  if (i > slideIndex.value) return '0%'
  const dur = Math.max(1, currentSlide.value?.durationSeconds ?? 5) * 1000
  const p = Math.min(100, (tick.value / dur) * 100)
  return `${p}%`
}

function clearTimers() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
}

async function recordView(slideId: string) {
  if (!props.shopId || recordedSlides.has(slideId)) return
  recordedSlides.add(slideId)
  try {
    await $fetch('/api/stories/views', {
      method: 'POST',
      headers: { 'x-shop-id': props.shopId },
      body: { slideId },
    })
  } catch {
    recordedSlides.delete(slideId)
  }
}

function nextSlide() {
  clearTimers()
  const c = props.campaign
  if (!c?.slides?.length) return
  if (slideIndex.value < c.slides.length - 1) {
    slideIndex.value += 1
  } else {
    close()
  }
}

function prevSlide() {
  clearTimers()
  if (slideIndex.value > 0) {
    slideIndex.value -= 1
  }
}

function onVideoEnded() {
  clearTimers()
  nextSlide()
}

function scheduleSlide() {
  clearTimers()
  tick.value = 0
  const slide = currentSlide.value
  if (!slide || !props.modelValue) return

  void recordView(slide.id)

  const durMs = Math.max(1000, (slide.durationSeconds ?? 5) * 1000)
  const start = Date.now()
  tickTimer = setInterval(() => {
    tick.value = Date.now() - start
  }, 50)

  if (isImageUrl(slide.mediaUrl)) {
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, durMs)
  } else {
    // video: advance on end; fallback if no ended event
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, durMs * 4)
  }
}

function onTapContent(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  if (x < rect.width / 2) prevSlide()
  else nextSlide()
}

function onActionClick() {
  const s = currentSlide.value
  if (!s) return
  emit('action', { slide: s, actionType: s.actionType })
}

function close() {
  clearTimers()
  emit('update:modelValue', false)
}

watch(
  () => [props.modelValue, props.campaign?.id, slideIndex.value] as const,
  () => {
    if (!props.modelValue || !props.campaign) {
      clearTimers()
      return
    }
    scheduleSlide()
  },
  { immediate: true },
)

watch(
  () => props.campaign?.id,
  () => {
    slideIndex.value = 0
    tick.value = 0
    recordedSlides.clear()
  },
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      slideIndex.value = 0
      recordedSlides.clear()
    }
  },
)

onBeforeUnmount(() => {
  clearTimers()
})
</script>
