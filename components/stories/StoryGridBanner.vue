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
        class="relative mt-auto bg-gradient-to-t from-black/70 to-transparent p-4 pt-16"
      >
        <p class="text-sm font-semibold text-white drop-shadow">
          {{ campaign.title }}
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
import type { StoryCampaignDto } from '~/types/stories'
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

const coverUrl = computed(() => {
  const first = props.campaign.slides?.[0]
  return first?.mediaUrl || props.campaign.previewUrl || ''
})
</script>
