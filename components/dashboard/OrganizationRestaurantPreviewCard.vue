<template>
  <article
    class="overflow-hidden rounded-2xl border"
    :style="{
      borderColor: tokens.brandSecondary,
      backgroundColor: tokens.surfaceCard,
      color: tokens.textPrimary,
      borderRadius: `${radii.card}px`,
    }"
  >
    <div class="h-28 w-full" :style="heroStyle">
      <img
        v-if="heroImageUrl"
        :src="heroImageUrl"
        alt="Hero"
        class="h-full w-full object-cover"
      >
    </div>
    <div class="space-y-2 p-4">
      <div class="flex items-center gap-3">
        <img
          v-if="logoUrl"
          :src="logoUrl"
          alt="Logo"
          class="h-10 w-10 rounded-full border object-cover"
          :style="{ borderColor: tokens.brandSecondary }"
        >
        <div v-else class="flex h-10 w-10 items-center justify-center rounded-full border text-xs" :style="{ borderColor: tokens.brandSecondary }">
          Logo
        </div>
        <div>
          <h3 class="text-sm font-semibold">{{ displayName || 'Название ресторана' }}</h3>
          <p class="text-xs" :style="{ color: tokens.textMuted }">{{ tagline || 'Tagline ресторана' }}</p>
        </div>
      </div>
      <p class="line-clamp-2 text-xs" :style="{ color: tokens.textMuted }">
        {{ description || 'Короткое описание для карточки ресторана в агрегаторе.' }}
      </p>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium text-white"
        :style="{ backgroundColor: tokens.brandPrimary, borderRadius: `${radii.button}px` }"
      >
        Открыть меню
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrganizationStyleConfig } from '../../types/organization-style'

const props = defineProps<{
  displayName: string
  tagline: string
  description: string
  logoUrl: string
  heroImageUrl: string
  styleConfig: Pick<OrganizationStyleConfig, 'tokens' | 'radii'>
}>()

const tokens = computed(() => props.styleConfig.tokens)
const radii = computed(() => props.styleConfig.radii)
const heroStyle = computed(() => ({
  background: `linear-gradient(135deg, ${tokens.value.brandPrimary}33, ${tokens.value.brandAccent}33)`,
}))
</script>
