<template>
  <StoryViewer
    v-model="viewerOpen"
    :campaign="activeCampaign"
    :campaigns="campaigns"
    :auto-advance-campaigns="autoAdvanceCampaigns"
    :shop-id="shopId"
    @action="$emit('action', $event)"
    @campaign-change="onCampaignChange"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StoryCampaignDto, StorySlideDto } from '~/types/stories'
// @ts-ignore Nuxt SFC auto-export
import StoryViewer from './StoryViewer.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    campaign: StoryCampaignDto | null
    campaigns?: StoryCampaignDto[]
    autoAdvanceCampaigns?: boolean
    shopId: string | null
  }>(),
  {
    campaigns: () => [],
    autoAdvanceCampaigns: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'campaign-change', campaign: StoryCampaignDto): void
  (e: 'action', payload: { slide: StorySlideDto; actionType: string }): void
}>()

const activeCampaign = ref<StoryCampaignDto | null>(props.campaign)

const viewerOpen = computed<boolean>({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

watch(
  () => props.campaign,
  (campaign: StoryCampaignDto | null) => {
    activeCampaign.value = campaign
  },
  { immediate: true },
)

watch(
  () => props.campaigns,
  (list: StoryCampaignDto[]) => {
    if (!list.length) return
    const current = activeCampaign.value
    if (!current) {
      activeCampaign.value = list[0]
      return
    }
    const stillExists = list.some((item: StoryCampaignDto) => item.id === current.id)
    if (!stillExists) activeCampaign.value = list[0]
  },
  { deep: true },
)

function onCampaignChange(campaign: StoryCampaignDto) {
  activeCampaign.value = campaign
  emit('campaign-change', campaign)
}
</script>
