<template>
  <article
    class="flex h-full min-h-[280px] w-full cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[320px]"
    :style="{ borderColor: theme.primary_100 || '#e5e7eb', backgroundColor: cardBg }"
    role="button"
    @click="$emit('open', campaign)"
  >
    <div class="relative flex min-h-0 flex-1 flex-col">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="campaign.title"
        class="absolute inset-0 h-full w-full object-cover"
      >
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center px-4 text-center"
        :style="{ backgroundColor: fallbackBg, color: mainText }"
      >
        <span class="text-sm font-semibold">
          {{ cleanTitle }}
        </span>
      </div>
      <div
        class="relative mt-auto bg-gradient-to-t from-black/70 to-transparent p-4 pt-16"
      >
        <p class="text-sm font-semibold text-white drop-shadow">
          {{ cleanTitle }}
        </p>
        <p class="mt-1 text-xs text-white/90">
          Сториз
        </p>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StoryCampaignDto, StorySlideDto } from '~/types/stories'
import { useTenant } from '~/composables/useTenant'

const props = defineProps<{
  campaign: StoryCampaignDto
}>()

defineEmits<{
  (e: 'open', campaign: StoryCampaignDto): void
}>()

const { tenant } = useTenant()
const theme = computed(() => tenant.value.theme || {})
const cardBg = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const fallbackBg = computed(() => theme.value.primary_50 || '#f3f4f6')
const mainText = computed(() => theme.value.text_primary || '#111827')

const coverUrl = computed(() => {
  const firstImageSlide = props.campaign.slides?.find((s: StorySlideDto) => isImageUrl(s.mediaUrl))
  if (firstImageSlide?.mediaUrl) return firstImageSlide.mediaUrl
  if (isImageUrl(props.campaign.previewUrl || '')) return props.campaign.previewUrl || ''
  return ''
})

const cleanTitle = computed(() => props.campaign.title.replace(/^\[DEMO\]\s*/i, '').trim())

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || url.includes('/image')
}
</script>
