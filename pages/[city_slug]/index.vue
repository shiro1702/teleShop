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

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section
        v-if="isFestivalMode"
        class="mb-6 w-full border-b"
        style="background-color: rgb(20, 22, 43); border-bottom-color: rgb(245, 194, 222);"
      >
        <div class="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            class="absolute left-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
            aria-label="Прокрутить сторисы влево"
            style="border-color: rgb(245, 194, 222);"
            @click="scrollStoriesBy(-220)"
          >
            ←
          </button>
          <div ref="festivalStoriesScrollEl" class="flex gap-3 overflow-x-auto [scrollbar-width:none]">
            <NuxtLink
              v-for="card in festivalStoryCards"
              :key="card.id"
              :to="card.to"
              class="group relative h-[176px] w-[128px] shrink-0 overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-[240px] sm:w-[200px]"
              style="border-color: rgb(245, 194, 222); background-color: rgb(20, 22, 43);"
            >
              <img :src="card.image" :alt="card.title" class="h-full w-full object-cover">
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                <p class="text-xs font-semibold text-white sm:text-sm">{{ card.title }}</p>
                <p class="mt-1 line-clamp-2 text-[10px] text-white/80 sm:text-xs">{{ card.subtitle }}</p>
              </div>
              <div class="pointer-events-none absolute inset-0 rounded-2xl border-0 transition group-hover:border-2" style="border-color: rgb(220, 50, 146);" />
            </NuxtLink>
          </div>
          <button
            type="button"
            class="absolute right-1 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-gray-700 shadow-sm backdrop-blur md:inline-flex"
            aria-label="Прокрутить сторисы вправо"
            style="border-color: rgb(245, 194, 222);"
            @click="scrollStoriesBy(220)"
          >
            →
          </button>
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

      <section class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <label class="block text-sm font-medium text-gray-700">
          Поиск по ресторанам
          <input
            v-model.trim="search"
            type="text"
            class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Например: Суши"
          >
        </label>
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
          <template v-if="search">
            Ничего не найдено по запросу.
          </template>
          <template v-else>
            <span v-if="isFestivalMode">Нет доступных корнеров в режиме «В ресторане».</span>
            <span v-else>Нет заведений с выбранным режимом. Переключите режим отображения выше.</span>
          </template>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { MapPointInput } from '~/composables/useGeocodedMarkers'
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
type CachedEntry<T> = { expiresAt: number, data: T }

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

const search = ref('')
const listMode = ref<'delivery' | 'pickup' | 'dine-in'>('dine-in')
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
const isFestivalMode = computed(() => !!festival.value)
const activeFestivalSlug = computed(() => forcedFestivalSlug.value || festival.value?.slug || '')
const festivalName = computed(() => festival.value?.name || 'Фестиваль')
const festivalDescription = computed(() => festival.value?.description || '')
const festivalStoriesScrollEl = ref<HTMLElement | null>(null)
const festivalStoryCards = computed(() => {
  const city = citySlug.value || 'ulan-ude'
  const festivalSlug = activeFestivalSlug.value || 'festival'
  const firstTenant = shops.value[0]?.slug
  return [
    {
      id: 'leaderboard',
      title: 'Лидерборд фестиваля',
      subtitle: 'Хит фестиваля и Народная любовь в реальном времени.',
      to: '/dashboard/festival-leaderboard',
      image: '/pixel-assets/preview-levelup.webp',
    },
    {
      id: 'achievements',
      title: 'Достижения клиента',
      subtitle: 'Прогресс по персональным целям: Гастро-турист, Флэш, Легенда.',
      to: firstTenant
        ? `/${city}/festival/${festivalSlug}/${firstTenant}/achievements`
        : `/${city}/achievements`,
      image: '/pixel-assets/preview-reviews.webp',
    },
    {
      id: 'pulse',
      title: 'Пульс фестиваля',
      subtitle: 'Съедено позиций, GMV и пиковые минуты заказов.',
      to: `/${city}/festival/${festivalSlug}`,
      image: '/pixel-assets/preview-start-game.webp',
    },
    {
      id: 'schedule',
      title: 'Сегодня на фестивале',
      subtitle: 'QR-вход, pickup-only и быстрая выдача без живой очереди.',
      to: `/${city}/festival/${festivalSlug}`,
      image: '/pixel-assets/preview-cashback.webp',
    },
  ]
})
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

const displayShops = computed(() => {
  const q = search.value.toLowerCase()
  const base = filteredByMode.value
  if (!q) return base
  return base.filter((s: ShopItem) => s.name.toLowerCase().includes(q))
})

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

function scrollStoriesBy(delta: number) {
  festivalStoriesScrollEl.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

function shopLink(shop: ShopItem): string {
  if (isFestivalMode.value && activeFestivalSlug.value) {
    return `/${citySlug.value}/festival/${activeFestivalSlug.value}/${shop.slug}`
  }
  return `/${citySlug.value}/${shop.slug}`
}

function yandexMapsLink(address: string) {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
}

function persistCityMode(mode: 'delivery' | 'pickup' | 'dine-in') {
  if (isFestivalMode.value) return
  writeCityFulfillmentMode(citySlug.value, mode)
}

function selectListMode(mode: 'delivery' | 'pickup' | 'dine-in') {
  listMode.value = mode
  // Пишем сразу, чтобы переход в ресторан после клика не терял выбор из-за отложенного watch.
  persistCityMode(mode)
}

watch(listMode, (mode: 'delivery' | 'pickup' | 'dine-in') => {
  if (isFestivalMode.value) return
  persistCityMode(mode)
})

function pickInitialListMode(list: ShopItem[]): 'delivery' | 'pickup' | 'dine-in' {
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

function modeAllowed(mode: 'delivery' | 'pickup' | 'dine-in', list: ShopItem[]) {
  if (mode === 'delivery') return list.some((s) => s.fulfillment?.delivery)
  if (mode === 'pickup') return list.some((s) => s.fulfillment?.pickup)
  return list.some((s) => s.fulfillment?.dineIn)
}

function restoreListMode(list: ShopItem[]) {
  if (isFestivalMode.value) {
    listMode.value = pickInitialListMode(list)
    return
  }
  if (!list.length) {
    listMode.value = 'delivery'
    return
  }
  if (typeof window === 'undefined') {
    listMode.value = pickInitialListMode(list)
    return
  }
  const slug = citySlug.value
  if (!slug) {
    listMode.value = pickInitialListMode(list)
    return
  }
  const raw = readCityFulfillmentMode(slug)
  if (raw && modeAllowed(raw, list)) {
    listMode.value = raw
    return
  }
  listMode.value = pickInitialListMode(list)
}

watch(shops, (list: ShopItem[]) => {
  if (!list.length) return
  if (!modeAllowed(listMode.value, list)) {
    listMode.value = pickInitialListMode(list)
  }
}, { deep: true })

watch(shops, (list: ShopItem[]) => {
  restoreListMode(list)
}, { immediate: true })
</script>
