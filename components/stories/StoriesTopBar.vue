<template>
  <div
    v-if="campaigns.length"
    class="border-b px-4 py-3 sm:px-6"
    :style="{ borderColor: borderColor, backgroundColor: cardBg }"
  >
    <div class="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <button
        v-for="c in campaigns"
        :key="c.id"
        type="button"
        class="flex shrink-0 flex-col items-center gap-1"
        @click="$emit('open', c)"
      >
        <span
          class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 p-0.5 shadow-sm"
          :style="{ borderColor: ringColor }"
        >
          <img
            v-if="c.previewUrl"
            :src="c.previewUrl"
            :alt="c.title"
            class="h-full w-full rounded-full object-cover"
          >
          <span
            v-else
            class="flex h-full w-full items-center justify-center rounded-full text-xs font-semibold"
            :style="{ backgroundColor: fallbackBg, color: mainText }"
          >
            {{ c.title.slice(0, 2) }}
          </span>
        </span>
        <span class="max-w-[4.5rem] truncate text-center text-[11px] font-medium" :style="{ color: mutedText }">
          {{ c.title }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StoryCampaignDto } from '~/types/stories'
import { useTenant } from '~/composables/useTenant'

defineProps<{
  campaigns: StoryCampaignDto[]
}>()

defineEmits<{
  (e: 'open', campaign: StoryCampaignDto): void
}>()

const { tenant } = useTenant()
const theme = computed(() => tenant.value.theme || {})
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')
const cardBg = computed(() => theme.value.surface_card || 'var(--color-surface-card)')
const ringColor = computed(() => 'var(--color-primary)')
const mainText = computed(() => theme.value.text_primary || '#111827')
const mutedText = computed(() => theme.value.text_muted || '#6b7280')
const fallbackBg = computed(() => theme.value.primary_50 || '#f3f4f6')
</script>
