<template>
  <section
    v-if="showBlock"
    class="mb-10 overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6"
    :style="cardStyle"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold" :style="{ color: mainTextColor }">Отзывы</h2>
        <p v-if="ratingText" class="mt-1 text-sm" :style="{ color: mutedTextColor }">
          {{ ratingText }}
        </p>
      </div>
      <div v-if="publicRating != null" class="text-right">
        <p class="text-2xl font-bold" :style="{ color: mainTextColor }">{{ publicRating.toFixed(1) }}</p>
        <p class="text-xs" :style="{ color: mutedTextColor }">из 5</p>
      </div>
    </div>
    <ul v-if="items.length" class="mt-4 space-y-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border p-3 text-sm"
        :style="{ borderColor: borderColor, backgroundColor: pageBgColor }"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold" :style="{ color: mainTextColor }">
            {{ '★'.repeat(clampStars(item.rating)) }}{{ '☆'.repeat(5 - clampStars(item.rating)) }}
          </div>
          <div class="text-xs" :style="{ color: mutedTextColor }">
            {{ formatAt(item.publishedAt) }}
          </div>
        </div>
        <p v-if="item.comment" class="mt-2 leading-relaxed" :style="{ color: mainTextColor }">
          {{ item.comment }}
        </p>
        <a
          v-if="item.videoUrl"
          :href="item.videoUrl"
          target="_blank"
          rel="noopener"
          class="mt-2 inline-block text-sm font-medium text-primary underline"
        >
          Смотреть видео
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTenant } from '~/composables/useTenant'

const props = defineProps<{
  shopId: string
  restaurantId?: string | null
}>()

const { tenant } = useTenant()
const theme = computed(() => tenant.value.theme || {})
const mainTextColor = computed(() => theme.value.text_primary || 'var(--color-text-primary)')
const mutedTextColor = computed(() => theme.value.text_muted || 'var(--color-text-muted)')
const borderColor = computed(() => theme.value.primary_100 || '#e5e7eb')
const pageBgColor = computed(() => theme.value.surface_background || 'var(--color-surface-bg)')
const cardBgColor = computed(() => theme.value.surface_card || 'var(--color-surface-card)')

const cardStyle = computed(() => ({
  borderColor: borderColor.value,
  backgroundColor: cardBgColor.value,
  color: mainTextColor.value,
}))

const loaded = ref(false)
const moduleEnabled = ref(false)
const publicRating = ref<number | null>(null)
const sampleCount = ref(0)
const formula = ref('')
const items = ref<Array<{
  id: string
  rating: number
  comment: string | null
  videoUrl: string | null
  publishedAt: string
}>>([])

const showBlock = computed(() => loaded.value && moduleEnabled.value && (publicRating.value != null || items.value.length > 0))

const ratingText = computed(() => {
  if (publicRating.value == null && !items.value.length) return ''
  const parts = []
  if (formula.value) parts.push(formula.value)
  if (sampleCount.value) parts.push(`в выборке: ${sampleCount.value}`)
  return parts.join(' · ')
})

function clampStars(r: number) {
  const n = Math.round(Number(r) || 0)
  return Math.min(5, Math.max(1, n))
}

function formatAt(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

async function load() {
  const shop = props.shopId?.trim()
  if (!shop) return
  loaded.value = false
  try {
    const query: Record<string, string> = { shop_id: shop, limit: '12' }
    if (props.restaurantId) query.restaurant_id = props.restaurantId
    const res = await $fetch<{
      ok: boolean
      moduleEnabled?: boolean
      items: any[]
      rating: { public_rating: number | null; sample_count: number; formula: string }
    }>('/api/reviews', { query })
    moduleEnabled.value = res.moduleEnabled !== false
    items.value = Array.isArray(res.items)
      ? res.items.map((x: any) => ({
        id: String(x.id),
        rating: Number(x.rating || 0),
        comment: typeof x.comment === 'string' ? x.comment : null,
        videoUrl: typeof x.videoUrl === 'string' ? x.videoUrl : null,
        publishedAt: String(x.publishedAt || ''),
      }))
      : []
    publicRating.value = res.rating?.public_rating ?? null
    sampleCount.value = Number(res.rating?.sample_count || 0)
    formula.value = typeof res.rating?.formula === 'string' ? res.rating.formula : ''
  } catch {
    moduleEnabled.value = false
    items.value = []
    publicRating.value = null
  } finally {
    loaded.value = true
  }
}

onMounted(load)
watch(() => [props.shopId, props.restaurantId], load)
</script>
