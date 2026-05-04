<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white/95 backdrop-blur">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 class="text-2xl font-bold text-gray-900">
          {{ isFestivalMode ? `Фестиваль: ${festivalName}` : `Рестораны в ${cityNameRu}` }}
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ isFestivalMode ? 'Выберите корнер, закажите и заберите без очереди.' : 'меню в вашем кармане. Доставку и готовку выполняет каждый ресторан самостоятельно.' }}
        </p>
      </div>
    </header>

    <div
      v-if="showModeSwitcher"
      class="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div class="inline-flex flex-1 flex-wrap gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:max-w-2xl">
          <button
            v-if="modeAvailability.delivery"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
            :class="listMode === 'delivery'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-white'"
            @click="selectListMode('delivery')"
          >
            Доставка
          </button>
          <button
            v-if="modeAvailability.pickup"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
            :class="listMode === 'pickup'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-white'"
            @click="selectListMode('pickup')"
          >
            Самовывоз
          </button>
          <button
            v-if="modeAvailability.dineIn"
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
            :class="listMode === 'dine-in'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-white'"
            @click="selectListMode('dine-in')"
          >
            В&nbsp;ресторане
          </button>
        </div>
      </div>
    </div>
    <StoriesTopBar
      v-if="isFestivalMode && festivalStoryCampaigns.length"
      :campaigns="festivalStoryCampaigns"
      :loading="false"
      @open="openFestivalStoryCampaign"
    />
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section
        v-if="showFestivalBanner"
        class="mb-6 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm sm:p-6"
      >
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
              Сейчас проходит фестиваль
            </p>
            <h2 class="mt-2 text-2xl font-bold text-gray-900">
              {{ festivalName }}
            </h2>
            <p v-if="festivalDescription" class="mt-2 text-sm leading-6 text-gray-700">
              {{ festivalDescription }}
            </p>
            <p v-if="festivalPlace" class="mt-3 text-sm font-medium text-amber-800">
              Место: {{ festivalPlace }}
            </p>
          </div>
          <NuxtLink
            :to="festivalPublicPath"
            class="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            Перейти на фестиваль
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="isFestivalMode"
        class="mb-6 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2 sm:p-6"
      >
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Пульс фестиваля</p>
          <h2 class="mt-2 text-lg font-semibold text-amber-900">{{ festivalName }}</h2>
          <p v-if="festivalDescription" class="mt-1 text-sm text-amber-800">{{ festivalDescription }}</p>
          <ul class="mt-3 space-y-1 text-sm text-amber-900">
            <li v-for="(line, idx) in pulseStatsList" :key="`pulse-${idx}`">{{ line }}</li>
          </ul>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Расписание</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="(item, idx) in festivalScheduleList"
              :key="`schedule-${idx}`"
              class="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-900"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <section
        v-if="!isFestivalMode && listMode === 'pickup' && pickupMapMarkers.length && !pending"
        class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div class="border-b border-gray-100 px-4 py-3 sm:px-6">
          <h2 class="text-sm font-semibold text-gray-900">
            Карта: пункты самовывоза
          </h2>
          <p class="mt-0.5 text-xs text-gray-500">
            Все точки самовывоза в городе (кластеры — число заведений рядом).
          </p>
        </div>
        <ClientOnly>
          <LazyMapsOsmClusterMap
            :markers="pickupMapMarkers"
            :city-name="cityNameRu"
          />
        </ClientOnly>
        <ul class="divide-y divide-gray-100 px-4 py-2 sm:px-6">
          <li
            v-for="(pt, idx) in pickupMapMarkers"
            :key="`${pt.id}-${idx}`"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-900">
                {{ pt.title }}
              </p>
              <p v-if="pt.subtitle" class="text-xs text-gray-500">
                {{ pt.subtitle }}
              </p>
              <p class="text-xs text-gray-600">
                {{ pt.address }}
              </p>
            </div>
            <a
              :href="yandexMapsLink(pt.address)"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-50"
            >
              На карте
            </a>
          </li>
        </ul>
      </section>

      <section
        v-if="!isFestivalMode && listMode === 'dine-in' && dineInMapMarkers.length && !pending"
        class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div class="border-b border-gray-100 px-4 py-3 sm:px-6">
          <h2 class="text-sm font-semibold text-gray-900">
            Карта: в&nbsp;ресторане
          </h2>
          <p class="mt-0.5 text-xs text-gray-500">
            Заведения, где можно заказать в зале (отдельно от пунктов выдачи самовывоза).
          </p>
        </div>
        <ClientOnly>
          <LazyMapsOsmClusterMap
            :markers="dineInMapMarkers"
            :city-name="cityNameRu"
          />
        </ClientOnly>
        <ul class="divide-y divide-gray-100 px-4 py-2 sm:px-6">
          <li
            v-for="(pt, idx) in dineInMapMarkers"
            :key="`${pt.id}-${idx}`"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-900">
                {{ pt.title }}
              </p>
              <p v-if="pt.subtitle" class="text-xs text-gray-500">
                {{ pt.subtitle }}
              </p>
              <p class="text-xs text-gray-600">
                {{ pt.address }}
              </p>
            </div>
            <a
              :href="yandexMapsLink(pt.address)"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-50"
            >
              На карте
            </a>
          </li>
        </ul>
      </section>

      <section v-if="pending" class="text-sm text-gray-600">
        Загрузка ресторанов...
      </section>

      <section v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ errorMessage }}
      </section>

      <section v-else>
        <h2 class="mb-4 text-lg font-semibold text-gray-900">
          Выберите ресторан
        </h2>

        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="shop in displayShops"
            :key="shop.id"
            class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary"
          >
            <NuxtLink :to="shopLink(shop)" class="block">
              <div class="flex items-start gap-3">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50 text-primary">
                  <img
                    v-if="shop.logoUrl"
                    :src="shop.logoUrl"
                    :alt="shop.name"
                    class="h-full w-full object-cover"
                  >
                  <span v-else class="text-sm font-bold">{{ shop.name.slice(0, 1).toUpperCase() }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-gray-900">
                    {{ shop.name }}
                  </p>
                  <p class="mt-1 text-xs text-gray-500">
                    Перейти к меню
                  </p>
                  <div
                    v-if="listMode === 'pickup' && shop.pickupPoints?.length"
                    class="mt-2 space-y-1 border-t border-gray-100 pt-2"
                  >
                    <p class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Самовывоз
                    </p>
                    <p
                      v-for="(pp, pi) in shop.pickupPoints.slice(0, 2)"
                      :key="pi"
                      class="line-clamp-2 text-xs text-gray-600"
                    >
                      {{ pp.address }}
                    </p>
                    <p
                      v-if="shop.pickupPoints.length > 2"
                      class="text-xs text-gray-400"
                    >
                      ещё {{ shop.pickupPoints.length - 2 }}…
                    </p>
                  </div>
                  <div
                    v-if="listMode === 'dine-in' && shop.dineInPoints?.length"
                    class="mt-2 space-y-1 border-t border-gray-100 pt-2"
                  >
                    <p class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      В&nbsp;ресторане
                    </p>
                    <p
                      v-for="(dp, di) in shop.dineInPoints.slice(0, 2)"
                      :key="di"
                      class="line-clamp-2 text-xs text-gray-600"
                    >
                      {{ dp.address }}
                    </p>
                    <p
                      v-if="shop.dineInPoints.length > 2"
                      class="text-xs text-gray-400"
                    >
                      ещё {{ shop.dineInPoints.length - 2 }}…
                    </p>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <div v-if="!displayShops.length" class="mt-6 text-sm text-gray-600">
          <span v-if="isFestivalMode">Нет доступных корнеров в режиме «В ресторане».</span>
          <span v-else>Нет заведений с выбранным режимом. Переключите режим отображения выше.</span>
        </div>
      </section>
    </main>
    <StoryViewerSwiper
      v-model="festivalStoryViewerOpen"
      :campaign="festivalStoryViewerCampaign"
      :campaigns="festivalStoryCampaigns"
      :auto-advance-campaigns="true"
      :shop-id="null"
      @action="onFestivalStoryAction"
      @campaign-change="festivalStoryViewerCampaign = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { MapPointInput } from '~/composables/useGeocodedMarkers'
// @ts-ignore Nuxt SFC auto-export
import StoriesTopBar from '~/components/stories/StoriesTopBar.vue'
// @ts-ignore Nuxt SFC auto-export
import StoryViewerSwiper from '~/components/stories/StoryViewerSwiper.vue'
import type { StoryCampaignDto, StorySlideDto } from '~/types/stories'
import {
  readCityFulfillmentMode,
  writeCityFulfillmentMode,
} from '~/utils/fulfillmentPreference'

type ShopFulfillment = {
  delivery: boolean
  pickup: boolean
  dineIn: boolean
}

type BranchPoint = {
  restaurantId: string
  name: string
  address: string
  lat?: number | null
  lon?: number | null
}

type ShopItem = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  description: string | null
  fulfillment?: ShopFulfillment
  pickupPoints?: BranchPoint[]
  dineInPoints?: BranchPoint[]
}

type CityResponse = {
  ok: boolean
  city: {
    id: string
    name: string
    slug: string
    isActive: boolean
  } | null
  festival?: {
    id: string
    slug: string
    name: string
    description: string | null
    pulseStats: Record<string, unknown>
    schedule: unknown[]
  } | null
}

type FestivalDto = NonNullable<CityResponse['festival']>
type ShopsResponse = { ok: boolean, items: ShopItem[] }
type CityListMode = 'delivery' | 'pickup' | 'dine-in'
type CachedEntry<T> = { expiresAt: number, data: T }
type FestivalStoryCard = {
  id: 'vibe' | 'food' | 'party' | 'quest' | 'leaderboard' | 'achievements' | 'pulse' | 'schedule'
  title: string
  subtitle: string
  to: string
  slides: FestivalStorySlide[]
}
type FestivalStorySlide = {
  title: string
  text: string
  html: string
  buttonLabel?: string
  to?: string
  durationSeconds?: number
}

const route = useRoute()
const citySlug = computed(() => (typeof route.params.city_slug === 'string' ? route.params.city_slug : ''))
const forcedFestivalSlug = computed(() => {
  if (typeof route.params.festival_slug === 'string' && route.params.festival_slug.trim()) {
    return route.params.festival_slug.trim()
  }
  if (typeof route.query.festival_slug === 'string' && route.query.festival_slug.trim()) {
    return route.query.festival_slug.trim()
  }
  return ''
})

const CITY_CACHE_TTL_MS = 5 * 60 * 1000
const SHOPS_CACHE_TTL_MS = 60 * 1000
const cityCache = useState<Record<string, CachedEntry<CityResponse>>>('city-page-city-cache', () => ({}))
const shopsCache = useState<Record<string, CachedEntry<ShopsResponse>>>('city-page-shops-cache', () => ({}))

function makeCacheKey(slug: string, festivalSlug: string) {
  return `${slug}::${festivalSlug || '-'}`
}

function readCached<T>(cacheState: Ref<Record<string, CachedEntry<T>>>, key: string): T | null {
  const cached = cacheState.value[key]
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    delete cacheState.value[key]
    return null
  }
  return cached.data
}

function writeCached<T>(cacheState: Ref<Record<string, CachedEntry<T>>>, key: string, data: T, ttlMs: number) {
  cacheState.value[key] = {
    data,
    expiresAt: Date.now() + ttlMs,
  }
}

function buildCityApiUrl(slug: string, festivalSlug: string) {
  const query = new URLSearchParams({ slug })
  if (festivalSlug) query.set('festival_slug', festivalSlug)
  return `/api/cities?${query.toString()}`
}

function buildShopsApiUrl(slug: string, festivalSlug: string) {
  const query = new URLSearchParams({ city_slug: slug })
  if (festivalSlug) query.set('festival_slug', festivalSlug)
  return `/api/shops?${query.toString()}`
}

/** Режим из данных города + localStorage (без ручного переключателя). */
const loadedListMode = ref<CityListMode>('delivery')
/** Явный выбор пользователя; если null — берём loadedListMode. */
const selectedListMode = ref<CityListMode | null>(null)

const listMode = computed<CityListMode>(() => selectedListMode.value ?? loadedListMode.value)
const {
  data: cityRes,
  pending: cityPending,
  error: cityError,
} = await useAsyncData<CityResponse>(
  () => `city-page-city:${makeCacheKey(citySlug.value, forcedFestivalSlug.value)}`,
  async () => {
    const slug = citySlug.value
    if (!slug) {
      return {
        ok: true,
        city: null,
        festival: null,
      } as CityResponse
    }
    const cacheKey = makeCacheKey(slug, forcedFestivalSlug.value)
    const cached = readCached(cityCache, cacheKey)
    if (cached) return cached
    const response = await $fetch<CityResponse>(buildCityApiUrl(slug, forcedFestivalSlug.value))
    writeCached(cityCache, cacheKey, response, CITY_CACHE_TTL_MS)
    return response
  },
  {
    server: true,
    watch: [citySlug, forcedFestivalSlug],
  },
)

const {
  data: shopsRes,
  pending: shopsPending,
  error: shopsError,
} = await useAsyncData<ShopsResponse>(
  () => `city-page-shops:${makeCacheKey(citySlug.value, forcedFestivalSlug.value)}`,
  async () => {
    const slug = citySlug.value
    if (!slug) {
      return { ok: true, items: [] } as ShopsResponse
    }
    const cacheKey = makeCacheKey(slug, forcedFestivalSlug.value)
    const cached = readCached(shopsCache, cacheKey)
    if (cached) return cached
    const response = await $fetch<ShopsResponse>(buildShopsApiUrl(slug, forcedFestivalSlug.value))
    writeCached(shopsCache, cacheKey, response, SHOPS_CACHE_TTL_MS)
    return response
  },
  {
    server: true,
    watch: [citySlug, forcedFestivalSlug],
  },
)

const cityNameRu = computed(() => cityRes.value?.city?.name || citySlug.value)
const pending = computed(() => cityPending.value || shopsPending.value)
const errorMessage = computed<string | null>(() => {
  if (!citySlug.value) return 'Город не указан в URL'
  if (cityError.value) return cityError.value.message || 'Не удалось загрузить город'
  if (shopsError.value) return shopsError.value.message || 'Не удалось загрузить рестораны'
  if (shopsRes.value && !shopsRes.value.ok) return 'Не удалось загрузить рестораны'
  return null
})
const shops = computed<ShopItem[]>(() => shopsRes.value?.items ?? [])
const festival = computed<FestivalDto | null>(() => cityRes.value?.festival ?? null)
const isFestivalMode = computed(() => !!festival.value && !!forcedFestivalSlug.value)
const activeFestivalSlug = computed(() => forcedFestivalSlug.value || festival.value?.slug || '')
const festivalName = computed(() => festival.value?.name || 'Фестиваль')
const festivalDescription = computed(() => festival.value?.description || '')
const festivalPublicPath = computed(() => `/${citySlug.value}/festival/${activeFestivalSlug.value || 'festival'}`)
const showFestivalBanner = computed(() => !!festival.value && !forcedFestivalSlug.value)
const festivalPlace = computed(() => {
  const descriptionMatch = festivalDescription.value.match(/Адрес:\s*([^.]*)/i)
  if (descriptionMatch?.[1]) return descriptionMatch[1].trim()
  const scheduleAddress = festival.value?.schedule.find((item: unknown) => String(item).toLowerCase().includes('адрес'))
  if (!scheduleAddress) return ''
  return String(scheduleAddress).replace(/^Адрес:\s*/i, '').trim()
})
const festivalStoryViewerOpen = ref(false)
const festivalStoryViewerCampaign = ref<StoryCampaignDto | null>(null)
const userModeTouched = ref(false)
const festivalLiveUgc = ref<Array<{
  id: string
  kind: 'story' | 'video_review'
  category: string | null
  mediaUrl: string
  rating: number | null
  createdAt: string
}>>([])

async function loadFestivalLiveUgc() {
  if (!isFestivalMode.value || !activeFestivalSlug.value) {
    festivalLiveUgc.value = []
    return
  }
  try {
    const data = await $fetch<{ ok: boolean; items?: Array<any> }>(
      `/api/festival/${encodeURIComponent(activeFestivalSlug.value)}/ugc?limit=30`,
    )
    festivalLiveUgc.value = Array.isArray(data?.items)
      ? data.items.map((x: any) => ({
        id: String(x.id),
        kind: x.kind === 'story' ? 'story' : 'video_review',
        category: typeof x.category === 'string' ? x.category : null,
        mediaUrl: String(x.mediaUrl || ''),
        rating: typeof x.rating === 'number' ? x.rating : null,
        createdAt: String(x.createdAt || ''),
      }))
      : []
  } catch {
    festivalLiveUgc.value = []
  }
}
const festivalStoryCards = computed<FestivalStoryCard[]>(() => {
  const city = citySlug.value || 'ulan-ude'
  const festivalSlug = activeFestivalSlug.value || 'festival'
  const firstTenant = shops.value[0]?.slug
  const festivalPath = `/${city}/festival/${festivalSlug}`
  const leaderboardPath = `${festivalPath}/leaderboard`
  const achievementsPath = `${festivalPath}/achievements`
  return [
    {
      id: 'vibe',
      title: 'Вайб (Live)',
      subtitle: 'Что происходит прямо сейчас.',
      to: festivalPath,
      slides: [
        {
          title: 'Вайб фестиваля',
          text: 'Смотри, как проходит фестиваль, и делись своими эмоциями.',
          html: `
            <h3>Live-лента</h3>
            <p>Здесь будут самые свежие сторис от гостей фестиваля.</p>
            <ul>
              <li>Снимай видео после заказа</li>
              <li>Смотри, как отдыхают другие</li>
              <li>Участвуй в баттлах и голосованиях</li>
            </ul>
          `,
          buttonLabel: 'Вайб',
          to: festivalPath,
        },
      ],
    },
    {
      id: 'food',
      title: 'Еда (Фудпорн)',
      subtitle: 'Самые сочные видеоотзывы.',
      to: festivalPath,
      slides: [
        {
          title: 'Только еда',
          text: 'Не знаешь, что выбрать? Смотри видеоотзывы от других гостей.',
          html: `
            <h3>Еда и ничего лишнего</h3>
            <p>Отзывы в формате коротких видео.</p>
            <ul>
              <li>Реальные порции и эмоции</li>
              <li>Кнопка "Хочу так же" для быстрого заказа</li>
            </ul>
          `,
          buttonLabel: 'Смотреть еду',
          to: festivalPath,
        },
      ],
    },
    {
      id: 'party',
      title: 'Отрыв',
      subtitle: 'Танцы, сцена и музыка.',
      to: festivalPath,
      slides: [
        {
          title: 'Отрыв',
          text: 'Что происходит на сцене и вокруг нее.',
          html: `
            <h3>Сцена и развлечения</h3>
            <p>Выступления артистов, конкурсы и просто хороший вайб.</p>
          `,
          buttonLabel: 'Смотреть отрыв',
          to: festivalPath,
        },
      ],
    },
    {
      id: 'leaderboard',
      title: 'Лидеры',
      subtitle: 'Кто обгоняет всех.',
      to: leaderboardPath,
      slides: [
        {
          title: 'Лидерборд фестиваля',
          text: 'Здесь видно, кто сейчас лидирует по заказам и оценкам гостей.',
          html: `
            <h3>Лидерборд фестиваля</h3>
            <p>Открытый рейтинг помогает гостям выбирать корнеры, а участникам — соревноваться честно.</p>
            <ul>
              <li>«Хит фестиваля» — по количеству проданных позиций.</li>
              <li>«Народная любовь» — по оценкам после получения заказа.</li>
            </ul>
          `,
          buttonLabel: 'Лидерборд',
          to: leaderboardPath,
        },
        {
          title: 'Как попасть в топ',
          text: 'Готовьте быстро, собирайте заказы и просите гостей оставить оценку после выдачи.',
          html: `
            <h3>Как попасть в топ</h3>
            <p>Места считаются по реальным действиям гостей, а не вручную.</p>
            <ul>
              <li>Больше заказанных блюд — выше шанс стать «Хитом фестиваля».</li>
              <li>Больше хороших оценок — ближе к номинации «Народная любовь».</li>
            </ul>
          `,
          buttonLabel: 'Лидерборд',
          to: leaderboardPath,
        },
      ],
    },
    {
      id: 'quest',
      title: 'Герои квеста',
      subtitle: 'Те, кто нашел все коды.',
      to: achievementsPath,
      slides: [
        {
          title: 'Герои квеста',
          text: 'Те, кто проходит задания и хвастается призами.',
          html: `
            <h3>Герои квеста</h3>
            <p>Те, кто проходит все задания, собирает все QR-коды и показывает призы.</p>
          `,
          buttonLabel: 'К достижениям',
          to: achievementsPath,
        },
      ],
    },
    {
      id: 'achievements',
      title: 'Ачивки',
      subtitle: 'Собирай фестивальные бейджи.',
      to: achievementsPath,
      slides: [
        {
          title: 'Достижения',
          text: 'Собери бейджи и открой ачивки фестиваля.',
          html: `
            <h3>Как работают достижения</h3>
            <p>Каждый заказ двигает прогресс. Чем активнее ты пробуешь фестиваль, тем больше бейджей открывается.</p>
            <ul>
              <li>«Гастро-турист» — попробуй разные корнеры.</li>
              <li>«Бездонный желудок» — 5 заказов за день.</li>
              <li>«Флэш» — забирай заказы за 1 минуту.</li>
              <li>И ещё 7 скрытых достижений!</li>
            </ul>
          `,
          buttonLabel: 'Посмотреть',
          to: achievementsPath,
        },
        {
          title: 'Зачем это вам',
          text: 'Достижения подсказывают, что еще попробовать, и превращают прогулку по фестивалю в небольшой квест.',
          html: `
            <h3>Фестивальный квест</h3>
            <p>Открой страницу достижений и смотри, сколько осталось до следующего бейджа.</p>
            <ul>
              <li>Выбирай новый корнер.</li>
              <li>Оформляй заказ через QR.</li>
              <li>Следи за прогрессом после покупки.</li>
            </ul>
          `,
          buttonLabel: 'Посмотреть',
          to: achievementsPath,
        },
      ],
    },
    {
      id: 'pulse',
      title: 'Пульс фестиваля',
      subtitle: 'Сколько заказов уже сделали и когда площадка живет активнее всего.',
      to: festivalPath,
      slides: [
        {
          title: 'Пульс фестиваля',
          text: 'Здесь собирается живая статистика события: заказы, популярные блюда и пиковые минуты.',
          html: `
            <h3>Пульс фестиваля</h3>
            <p>Это быстрый срез того, как сейчас живет площадка.</p>
            <ul>
              <li>Сколько позиций уже заказали гости.</li>
              <li>Какие минуты стали самыми активными.</li>
              <li>Сколько времени гости сэкономили без очереди.</li>
            </ul>
          `,
          buttonLabel: 'К фестивалю',
          to: festivalPath,
        },
      ],
    },
    {
      id: 'schedule',
      title: 'План мероприятий',
      subtitle: 'Что происходит сегодня: открытие, активности, музыка и награждение.',
      to: festivalPath,
      slides: [
        {
          title: 'План мероприятий',
          text: 'Ориентировочный сценарий дня: еда, активности, музыка и финальные номинации.',
          html: `
            <h3>План мероприятий</h3>
            <ul>
              <li>12:00 — старт фестиваля и открытие корнеров.</li>
              <li>14:00 — дегустационный маршрут: попробуй блюда у разных участников.</li>
              <li>17:00 — музыкальная программа и активности партнеров.</li>
              <li>20:00 — промежуточные итоги лидерборда на сцене.</li>
            </ul>
          `,
          buttonLabel: 'К фестивалю',
          to: festivalPath,
        },
        {
          title: 'Как заказать без очереди',
          text: 'Выбери корнер, оплати заказ в телефоне и подходи на выдачу, когда появится статус «Готово».',
          html: `
            <h3>Как заказать без очереди</h3>
            <p>Фестиваль работает в режиме быстрого самовывоза:</p>
            <ul>
              <li>Открой меню через QR.</li>
              <li>Выбери блюда у нужного корнера.</li>
              <li>Следи за статусом заказа и забери его на выдаче.</li>
            </ul>
          `,
          buttonLabel: 'К фестивалю',
          to: festivalPath,
        },
      ],
    },
  ]
})

const festivalStoryCampaigns = computed<StoryCampaignDto[]>(() =>
  [
    ...((() => {
      const liveItems = festivalLiveUgc.value.filter((x: { kind: string }) => x.kind === 'story').slice(0, 12)
      const foodItems = festivalLiveUgc.value.filter((x: { kind: string }) => x.kind === 'video_review').slice(0, 12)
      const campaigns: StoryCampaignDto[] = []
      if (liveItems.length) {
        campaigns.push({
          id: 'ugc-live',
          title: 'Live от гостей',
          previewUrl: liveItems[0].mediaUrl || null,
          placement: 'top_bar',
          slides: liveItems.map((item: { id: string; mediaUrl: string }, idx: number) => ({
            id: `ugc-live-${item.id}`,
            campaignId: 'ugc-live',
            sortOrder: idx,
            mediaUrl: item.mediaUrl,
            durationSeconds: 7,
            actionType: 'open_category',
            actionPayload: { to: festivalPublicPath.value },
            title: 'Live-лента',
            text: 'Свежие сторис от гостей фестиваля',
          })),
        })
      }
      if (foodItems.length) {
        campaigns.push({
          id: 'ugc-food',
          title: 'Видеоотзывы',
          previewUrl: foodItems[0].mediaUrl || null,
          placement: 'top_bar',
          slides: foodItems.map((item: { id: string; mediaUrl: string; rating: number | null }, idx: number) => ({
            id: `ugc-food-${item.id}`,
            campaignId: 'ugc-food',
            sortOrder: idx,
            mediaUrl: item.mediaUrl,
            durationSeconds: 7,
            actionType: 'open_category',
            actionPayload: { to: festivalPublicPath.value },
            title: 'Видеоотзыв',
            text: item.rating ? `Оценка: ${item.rating}/5` : 'Гость фестиваля делится впечатлениями',
          })),
        })
      }
      return campaigns
    })()),
    ...festivalStoryCards.value.map((card: FestivalStoryCard) => ({
    id: card.id,
    title: card.title,
    previewUrl: null,
    placement: 'top_bar' as const,
    slides: card.slides.map((slide: FestivalStorySlide, slideIdx: number) => ({
      id: `${card.id}-slide-${slideIdx + 1}`,
      campaignId: card.id,
      sortOrder: slideIdx,
      mediaUrl: '',
      durationSeconds: slide.durationSeconds ?? 7,
      actionType: 'open_category' as const,
      actionPayload: {
        to: slide.to || card.to,
        html: slide.html,
        buttonLabel: slide.buttonLabel,
      },
      title: slide.title || card.title,
      text: slide.text || card.subtitle,
    })),
  })),
  ],
)

const festivalStoryTargetByCampaignId = computed<Record<string, string>>(() =>
  festivalStoryCards.value.reduce<Record<string, string>>((acc: Record<string, string>, card: FestivalStoryCard) => {
    acc[card.id] = card.to
    return acc
  }, {}),
)

watch([isFestivalMode, activeFestivalSlug], async () => {
  await loadFestivalLiveUgc()
}, { immediate: true })

function openFestivalStoryCampaign(campaign: StoryCampaignDto) {
  festivalStoryViewerCampaign.value = campaign
  festivalStoryViewerOpen.value = true
}

function onFestivalStoryAction(payload: { slide: StorySlideDto; actionType: string }) {
  const campaignId = payload.slide.campaignId
  const payloadTo = payload.slide.actionPayload?.to
  const targetFromPayload = typeof payloadTo === 'string' ? payloadTo : ''
  const target = targetFromPayload || festivalStoryTargetByCampaignId.value[campaignId]
  if (!target) return
  festivalStoryViewerOpen.value = false
  void navigateTo(target)
}
const pulseStatsList = computed(() => {
  const src = festival.value?.pulseStats || {}
  const entries = Object.entries(src)
  if (!entries.length) return ['Съедено 1500 бургеров', 'Сэкономлено 400 часов в очереди']
  return entries.map(([k, v]) => `${k}: ${String(v)}`)
})
const festivalScheduleList = computed(() => {
  const src = festival.value?.schedule
  if (!Array.isArray(src) || !src.length) return ['12:00 — Открытие фестиваля', '20:00 — Награждение лидеров']
  return src.map((item) => String(item))
})

const modeAvailability = computed(() => ({
  delivery: shops.value.some((s: ShopItem) => s.fulfillment?.delivery),
  pickup: shops.value.some((s: ShopItem) => s.fulfillment?.pickup),
  dineIn: shops.value.some((s: ShopItem) => s.fulfillment?.dineIn),
}))

const showModeSwitcher = computed(() => {
  if (isFestivalMode.value) return false
  const m = modeAvailability.value
  return [m.delivery, m.pickup, m.dineIn].filter(Boolean).length >= 2
})

function shopMatchesMode(shop: ShopItem): boolean {
  const f = shop.fulfillment
  if (!f) return true
  if (listMode.value === 'delivery') return f.delivery
  if (listMode.value === 'pickup') return f.pickup
  return f.dineIn
}

const filteredByMode = computed(() => shops.value.filter((s: ShopItem) => shopMatchesMode(s)))

const displayShops = computed(() => filteredByMode.value)

function flattenMarkers(
  shopsList: ShopItem[],
  kind: 'pickup' | 'dine-in',
): MapPointInput[] {
  const seen = new Set<string>()
  const out: MapPointInput[] = []
  for (const s of shopsList) {
    const pts = kind === 'pickup' ? s.pickupPoints : s.dineInPoints
    for (const p of pts ?? []) {
      const id = `${s.id}-${p.restaurantId}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        title: p.name,
        subtitle: s.name,
        address: p.address,
        lat: typeof p.lat === 'number' && Number.isFinite(p.lat) ? p.lat : null,
        lon: typeof p.lon === 'number' && Number.isFinite(p.lon) ? p.lon : null,
      })
    }
  }
  return out
}

const pickupMapMarkers = computed(() => flattenMarkers(filteredByMode.value, 'pickup'))
const dineInMapMarkers = computed(() => flattenMarkers(filteredByMode.value, 'dine-in'))

function shopLink(shop: ShopItem): string {
  if (isFestivalMode.value && activeFestivalSlug.value) {
    return `/${citySlug.value}/festival/${activeFestivalSlug.value}/${shop.slug}`
  }
  return `/${citySlug.value}/${shop.slug}`
}

function yandexMapsLink(address: string) {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
}

function persistCityMode(mode: CityListMode) {
  if (isFestivalMode.value) return
  writeCityFulfillmentMode(citySlug.value, mode)
}

function selectListMode(mode: CityListMode) {
  userModeTouched.value = true
  selectedListMode.value = mode
  persistCityMode(mode)
}

function pickInitialListMode(list: ShopItem[]): CityListMode {
  if (isFestivalMode.value) {
    const canDineIn = list.some((s) => s.fulfillment?.dineIn)
    if (canDineIn) return 'dine-in'
  }
  const canD = list.some((s) => s.fulfillment?.delivery)
  const canP = list.some((s) => s.fulfillment?.pickup)
  const canI = list.some((s) => s.fulfillment?.dineIn)
  if (canD) return 'delivery'
  if (canP) return 'pickup'
  if (canI) return 'dine-in'
  return 'delivery'
}

function modeAllowed(mode: CityListMode, list: ShopItem[]) {
  if (mode === 'delivery') return list.some((s) => s.fulfillment?.delivery)
  if (mode === 'pickup') return list.some((s) => s.fulfillment?.pickup)
  return list.some((s) => s.fulfillment?.dineIn)
}

function resolveLoadedListMode(list: ShopItem[]): CityListMode {
  if (typeof window === 'undefined') {
    return pickInitialListMode(list)
  }
  const slug = citySlug.value
  if (!slug) return pickInitialListMode(list)
  const raw = readCityFulfillmentMode(slug)
  if (raw && modeAllowed(raw, list)) return raw
  return pickInitialListMode(list)
}

/**
 * Согласует «загруженный» режим (список ресторанов + localStorage) и явный выбор пользователя.
 * Два ref исключают гонки: клик только меняет selectedListMode, приход данных — loadedListMode.
 */
function reconcileListMode(list: ShopItem[]) {
  if (isFestivalMode.value) {
    if (!list.length) return
    loadedListMode.value = pickInitialListMode(list)
    selectedListMode.value = null
    userModeTouched.value = false
    return
  }
  if (!list.length) return

  const effective = selectedListMode.value ?? loadedListMode.value
  if (!modeAllowed(effective, list)) {
    selectedListMode.value = null
    userModeTouched.value = false
    loadedListMode.value = pickInitialListMode(list)
    return
  }

  loadedListMode.value = resolveLoadedListMode(list)

  if (userModeTouched.value) {
    const sel = selectedListMode.value
    if (sel && modeAllowed(sel, list)) return
    selectedListMode.value = null
    userModeTouched.value = false
    return
  }

  selectedListMode.value = null
}

watch(shops, (list: ShopItem[]) => {
  reconcileListMode(list)
}, { deep: true, immediate: true })

watch(citySlug, () => {
  userModeTouched.value = false
  selectedListMode.value = null
  reconcileListMode(shops.value)
})
</script>
