<template>
  <div v-if="loading || campaigns.length" class="mx-auto max-w-6xl px-4 py-3 sm:px-6">
    <div class="relative">
      <button
        type="button"
        class="absolute left-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
        :style="{ borderColor: borderColor }"
        aria-label="Прокрутить сторисы влево"
        @click="scrollBy(-scrollDelta)"
      >
        ←
      </button>

      <div ref="scrollEl" class="flex gap-3 overflow-x-auto [scrollbar-width:none]">
        <template v-if="loading && !campaigns.length">
          <div
            v-for="i in skeletonCount"
            :key="`story-skeleton-${i}`"
            class="h-[176px] w-[128px] shrink-0 animate-pulse overflow-hidden rounded-2xl border sm:h-[240px] sm:w-[200px]"
            :style="{ borderColor: borderColor, backgroundColor: fallbackBg }"
          >
            <div
              class="h-full w-full bg-gradient-to-br from-white/20 via-white/10 to-transparent"
            />
          </div>
        </template>

        <template v-else>
        <button
          v-for="c in campaigns"
          :key="c.id"
          type="button"
          class="group relative h-[176px] w-[128px] shrink-0 overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-[240px] sm:w-[200px]"
          :style="{ borderColor: borderColor, backgroundColor: cardBg }"
          @click="$emit('open', c)"
        >
          <img
            v-if="campaignPreviewUrl(c)"
            :src="campaignPreviewUrl(c)"
            :alt="titleWithoutDemo(c.title)"
            class="h-full w-full object-cover"
          >
          <div
            v-else
            class="flex h-full w-full items-center justify-center px-3 text-center text-sm font-semibold"
            :style="{ backgroundColor: fallbackBg, color: mainText }"
          >
            {{ titleWithoutDemo(c.title) }}
          </div>
          <div class="pointer-events-none absolute inset-0 rounded-2xl border-0 transition group-hover:border-2" :style="{ borderColor: ringColor }" />
        </button>
        </template>
      </div>

      <button
        type="button"
        class="absolute right-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
        :style="{ borderColor: borderColor }"
        aria-label="Прокрутить сторисы вправо"
        @click="scrollBy(scrollDelta)"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StoryCampaignDto } from '~/types/stories'
import { useTenant } from '~/composables/useTenant'

defineProps<{
  campaigns: StoryCampaignDto[]
  loading?: boolean
}>()

defineEmits<{
  (e: 'open', campaign: StoryCampaignDto): void
}>()

const { tenant } = useTenant()
const scrollEl = ref<HTMLElement | null>(null)
const skeletonCount = 4
/** ~ширина карточки + gap для кнопок прокрутки */
const scrollDelta = 220
const theme = computed(() => tenant.value.theme || {})
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')
const cardBg = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const ringColor = computed(() => theme.value.primary || 'var(--color-primary)')
const mainText = computed(() => theme.value.text_primary || '#111827')
const fallbackBg = computed(() => theme.value.primary_50 || '#f3f4f6')

function titleWithoutDemo(title: string): string {
  return title.replace(/^\[DEMO\]\s*/i, '').trim()
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || url.includes('/image')
}

function campaignPreviewUrl(c: StoryCampaignDto): string {
  if (c.previewUrl) return c.previewUrl
  const slide = c.slides?.find((s) => isImageUrl(s.mediaUrl))
  return slide?.mediaUrl ?? ''
}

function scrollBy(delta: number) {
  scrollEl.value?.scrollBy({ left: delta, behavior: 'smooth' })
}
</script>
