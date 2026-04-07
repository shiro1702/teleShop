<template>
  <Teleport to="body">
    <div
      v-if="activeCampaign && modelValue"
      class="fixed inset-0 z-[100] flex flex-col bg-black/75"
      role="dialog"
      aria-modal="true"
      @click.stop="close"
    >
      <div class="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6"
>
        <div class="relative h-full w-full max-h-[780px] max-w-[400px]" @click.stop="">
          
          <div class="flex shrink-0 gap-1 p-4 absolute top-0 right-0 left-0 z-20">
            <div
              v-for="(_, i) in activeCampaign.slides"
              :key="i"
              class="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              <div
                class="h-full bg-white transition-[width] duration-100 ease-linear"
                :style="{ width: progressWidth(i) }"
              />
            </div>
          </div>

          <button
            type="button"
            class="absolute -right-2 -top-2 z-20 rounded-full bg-black/55 p-2 text-white shadow-sm sm:-right-12 sm:top-0"
            aria-label="Закрыть"
            @click.stop="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            ref="storySurfaceRef"
            class="relative flex h-full w-full max-h-[780px] max-w-[400px] select-none overflow-hidden rounded-3xl bg-black touch-none"
            :style="surfaceTransformStyle"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerCancel"
          >
            <template v-if="currentSlide">
              <img
                v-if="isImageUrl(currentSlide.mediaUrl)"
                :src="currentSlide.mediaUrl"
                :alt="activeCampaign.title"
                class="pointer-events-none h-full w-full object-cover"
              >
              <video
                v-else
                :key="currentSlide.id"
                ref="videoRef"
                class="pointer-events-none h-full w-full object-cover"
                :src="currentSlide.mediaUrl"
                autoplay
                playsinline
                @ended="onVideoEnded"
              />
            </template>

            <div
              v-if="currentSlide && currentSlide.actionType !== 'none'"
              class="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-16 sm:px-4 sm:pb-4"
            >
              <button
                type="button"
                class="w-full rounded-xl bg-white py-3 text-base font-semibold text-gray-900"
                @click.stop="onActionClick"
              >
                {{ actionLabel }}
              </button>
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

const props = withDefaults(
  defineProps<{
    campaign: StoryCampaignDto | null
    /** Порядок как в ленте — для свайпа между группами */
    campaigns?: StoryCampaignDto[]
    shopId: string | null
    modelValue: boolean
  }>(),
  { campaigns: () => [] },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'action', payload: { slide: StorySlideDto; actionType: string }): void
  (e: 'campaign-change', campaign: StoryCampaignDto): void
}>()

const navIndex = ref(0)
const slideIndex = ref(0)
const tick = ref(0)
const videoRef = ref<HTMLVideoElement | null>(null)
const storySurfaceRef = ref<HTMLElement | null>(null)

const dragX = ref(0)
const pointerDown = ref(false)
const pointerDragging = ref(false)
let tickAnchorMs = 0

let tickTimer: ReturnType<typeof setInterval> | null = null
let advanceTimer: ReturnType<typeof setTimeout> | null = null
const recordedSlides = new Set<string>()

const playbackPaused = ref(false)
let holdPauseTimer: ReturnType<typeof setTimeout> | null = null

let pointerId: number | null = null
let startClientX = 0
let startClientY = 0
let downAt = 0
let lastClientX = 0
let maxAbsDx = 0
let maxAbsDy = 0

const SWIPE_THRESHOLD_RATIO = 0.2
const MOVE_CANCEL_HOLD_PX = 14
const TAP_MAX_PX = 12
const TAP_MAX_MS = 450
const HOLD_PAUSE_MS = 260

const activeCampaign = computed<StoryCampaignDto | null>(() => {
  const list = props.campaigns
  if (list.length) {
    const c = list[navIndex.value]
    if (c) return c
  }
  return props.campaign
})

const canSwipeCampaigns = computed(() => props.campaigns.length > 1)

const surfaceTransformStyle = computed(() => ({
  transform: `translateX(${dragX.value}px)`,
  opacity: `${(200-Math.abs(dragX.value))/200}`,
  transition: pointerDragging.value
    ? 'none'
    : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
}))

const currentSlide = computed<StorySlideDto | null>(() => {
  const c = activeCampaign.value
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
  const c = activeCampaign.value
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

function clearHoldTimer() {
  if (holdPauseTimer) {
    clearTimeout(holdPauseTimer)
    holdPauseTimer = null
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

function pausePlayback() {
  if (playbackPaused.value) return
  playbackPaused.value = true
  clearTimers()
  videoRef.value?.pause()
}

function resumePlayback() {
  if (!playbackPaused.value) return
  playbackPaused.value = false
  const slide = currentSlide.value
  if (!slide || !props.modelValue) return

  if (isImageUrl(slide.mediaUrl)) {
    tickAnchorMs = Date.now() - tick.value
    const durMs = Math.max(1000, (slide.durationSeconds ?? 5) * 1000)
    const remaining = Math.max(80, durMs - tick.value)
    tickTimer = setInterval(() => {
      tick.value = Date.now() - tickAnchorMs
    }, 50)
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, remaining)
  } else {
    void videoRef.value?.play()
    const durMs = Math.max(1000, (slide.durationSeconds ?? 5) * 1000)
    const remaining = Math.max(80, durMs - tick.value)
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, Math.max(remaining * 4, durMs * 2))
  }
}

function nextSlide() {
  clearTimers()
  const c = activeCampaign.value
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
  clearHoldTimer()
  playbackPaused.value = false
  tick.value = 0
  tickAnchorMs = Date.now()
  const slide = currentSlide.value
  if (!slide || !props.modelValue) return

  void recordView(slide.id)

  const durMs = Math.max(1000, (slide.durationSeconds ?? 5) * 1000)
  tickTimer = setInterval(() => {
    tick.value = Date.now() - tickAnchorMs
  }, 50)

  if (isImageUrl(slide.mediaUrl)) {
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, durMs)
  } else {
    advanceTimer = setTimeout(() => {
      clearTimers()
      nextSlide()
    }, durMs * 4)
  }
}

function syncNavFromCampaign() {
  const list = props.campaigns
  if (!props.campaign) {
    navIndex.value = 0
    return
  }
  if (!list.length) {
    navIndex.value = 0
    return
  }
  const i = list.findIndex((c) => c.id === props.campaign!.id)
  navIndex.value = i >= 0 ? i : 0
}

function getSurfaceWidth(): number {
  return storySurfaceRef.value?.getBoundingClientRect().width || 360
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  const t = e.target as HTMLElement | null
  if (t?.closest('button')) return

  pointerDown.value = true
  pointerDragging.value = true
  pointerId = e.pointerId
  startClientX = e.clientX
  startClientY = e.clientY
  lastClientX = e.clientX
  downAt = Date.now()
  maxAbsDx = 0
  maxAbsDy = 0

  storySurfaceRef.value?.setPointerCapture(e.pointerId)

  clearHoldTimer()
  holdPauseTimer = setTimeout(() => {
    if (!pointerDown.value) return
    if (maxAbsDx < MOVE_CANCEL_HOLD_PX && maxAbsDy < MOVE_CANCEL_HOLD_PX) {
      pausePlayback()
    }
  }, HOLD_PAUSE_MS)
}

function onPointerMove(e: PointerEvent) {
  if (!pointerDown.value || e.pointerId !== pointerId) return

  const dx = e.clientX - startClientX
  const dy = e.clientY - startClientY
  maxAbsDx = Math.max(maxAbsDx, Math.abs(dx))
  maxAbsDy = Math.max(maxAbsDy, Math.abs(dy))
  lastClientX = e.clientX

  if (maxAbsDx >= MOVE_CANCEL_HOLD_PX || maxAbsDy >= MOVE_CANCEL_HOLD_PX) {
    clearHoldTimer()
  }

  if (!canSwipeCampaigns.value) return

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) {
    dragX.value = dx
  }
}

function finishSwipeOrSnap() {
  const w = getSurfaceWidth()
  const threshold = w * SWIPE_THRESHOLD_RATIO
  const x = dragX.value

  if (canSwipeCampaigns.value && Math.abs(x) > threshold) {
    if (x < 0 && navIndex.value < props.campaigns.length - 1) {
      pointerDragging.value = false
      dragX.value = -w * 1.08
      window.setTimeout(() => {
        const nextIdx = navIndex.value + 1
        const c = props.campaigns[nextIdx]
        if (!c) return
        pointerDragging.value = true
        dragX.value = 0
        navIndex.value = nextIdx
        slideIndex.value = 0
        tick.value = 0
        recordedSlides.clear()
        emit('campaign-change', c)
        requestAnimationFrame(() => {
          pointerDragging.value = false
        })
      }, 320)
      return
    }
    if (x > 0 && navIndex.value > 0) {
      pointerDragging.value = false
      dragX.value = w * 1.08
      window.setTimeout(() => {
        const nextIdx = navIndex.value - 1
        const c = props.campaigns[nextIdx]
        if (!c) return
        pointerDragging.value = true
        dragX.value = 0
        navIndex.value = nextIdx
        slideIndex.value = 0
        tick.value = 0
        recordedSlides.clear()
        emit('campaign-change', c)
        requestAnimationFrame(() => {
          pointerDragging.value = false
        })
      }, 320)
      return
    }
  }

  pointerDragging.value = false
  dragX.value = 0
  if (playbackPaused.value) {
    resumePlayback()
  }
}

function tryTapNavigation() {
  const el = storySurfaceRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = lastClientX - rect.left
  if (x < rect.width / 2) prevSlide()
  else nextSlide()
}

function onPointerUp(e: PointerEvent) {
  if (!pointerDown.value || e.pointerId !== pointerId) return

  try {
    storySurfaceRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }

  const elapsed = Date.now() - downAt
  const tapLike =
    maxAbsDx < TAP_MAX_PX &&
    maxAbsDy < TAP_MAX_PX &&
    elapsed < TAP_MAX_MS &&
    Math.abs(dragX.value) < TAP_MAX_PX

  clearHoldTimer()
  pointerDown.value = false
  pointerDragging.value = false
  pointerId = null

  const wasPaused = playbackPaused.value
  const hadHorizontalDrag = canSwipeCampaigns.value && Math.abs(dragX.value) >= 4

  if (hadHorizontalDrag) {
    finishSwipeOrSnap()
    return
  }

  pointerDragging.value = false
  dragX.value = 0

  if (wasPaused) {
    resumePlayback()
    return
  }

  if (tapLike) {
    tryTapNavigation()
  }
}

function onPointerCancel(e: PointerEvent) {
  clearHoldTimer()
  pointerDown.value = false
  pointerDragging.value = false
  pointerId = null
  dragX.value = 0
  try {
    storySurfaceRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
  if (playbackPaused.value) resumePlayback()
}

function onActionClick() {
  const s = currentSlide.value
  if (!s) return
  emit('action', { slide: s, actionType: s.actionType })
}

function close() {
  clearTimers()
  clearHoldTimer()
  dragX.value = 0
  pointerDown.value = false
  pointerDragging.value = false
  playbackPaused.value = false
  emit('update:modelValue', false)
}

watch(
  () =>
    [
      props.modelValue,
      props.campaign?.id,
      props.campaigns.map((c) => c.id).join('|'),
    ] as const,
  () => {
    if (!props.modelValue || !props.campaign) return
    syncNavFromCampaign()
  },
  { immediate: true },
)

watch(
  () => [props.modelValue, activeCampaign.value?.id, slideIndex.value] as const,
  () => {
    if (!props.modelValue || !activeCampaign.value) {
      clearTimers()
      clearHoldTimer()
      return
    }
    scheduleSlide()
  },
  { immediate: true },
)

watch(
  () => activeCampaign.value?.id,
  () => {
    slideIndex.value = 0
    tick.value = 0
    dragX.value = 0
    recordedSlides.clear()
  },
)

watch(
  () => props.modelValue,
  (open: boolean) => {
    if (open) {
      syncNavFromCampaign()
      slideIndex.value = 0
      tick.value = 0
      recordedSlides.clear()
      dragX.value = 0
      playbackPaused.value = false
    } else {
      clearTimers()
      clearHoldTimer()
      dragX.value = 0
      playbackPaused.value = false
    }
  },
)

onBeforeUnmount(() => {
  clearTimers()
  clearHoldTimer()
})
</script>
