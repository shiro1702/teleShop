<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white/95 backdrop-blur">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 class="text-2xl font-bold text-gray-900">
          Рестораны в {{ cityNameRu }}
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          pocketmenu.ru - меню в вашем кармане. Доставку и готовку выполняет каждый ресторан самостоятельно.
        </p>
      </div>
    </header>

    <div
      v-if="showModeSwitcher"
      class="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span class="text-xs font-medium text-gray-500 sm:text-sm">Режим</span>
        <div class="inline-flex flex-1 gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-1 sm:max-w-md">
          <button
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
            :class="listMode === 'delivery'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-white'"
            @click="listMode = 'delivery'"
          >
            Доставка
          </button>
          <button
            type="button"
            class="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm"
            :class="listMode === 'pickup'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-gray-600 hover:bg-white'"
            @click="listMode = 'pickup'"
          >
            Самовывоз
          </button>
        </div>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
        v-if="listMode === 'pickup' && pickupMapPoints.length && !pending"
        class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div class="border-b border-gray-100 px-4 py-3 sm:px-6">
          <h2 class="text-sm font-semibold text-gray-900">
            Карта: пункты самовывоза
          </h2>
          <p class="mt-0.5 text-xs text-gray-500">
            Ориентир по первому адресу; подробности — в списке ниже и по ссылкам «На карте».
          </p>
        </div>
        <div class="aspect-[16/10] min-h-[220px] w-full bg-gray-100">
          <iframe
            v-if="pickupMapEmbedUrl"
            title="Карта пунктов самовывоза"
            class="h-full w-full border-0"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
            :src="pickupMapEmbedUrl"
          />
        </div>
        <ul class="divide-y divide-gray-100 px-4 py-2 sm:px-6">
          <li
            v-for="(pt, idx) in pickupMapPoints"
            :key="`${pt.address}-${idx}`"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-900">
                {{ pt.name }}
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
            <NuxtLink :to="`/${citySlug}/${shop.slug}`" class="block">
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
            Нет заведений с выбранным режимом. Переключите «Доставка» / «Самовывоз».
          </template>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type ShopFulfillment = {
  delivery: boolean
  pickup: boolean
}

type PickupPoint = { name: string, address: string }

type ShopItem = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  description: string | null
  fulfillment?: ShopFulfillment
  pickupPoints?: PickupPoint[]
}

type CityResponse = {
  ok: boolean
  city: {
    id: string
    name: string
    slug: string
    isActive: boolean
  } | null
}

const route = useRoute()
const citySlug = computed(() => (typeof route.params.city_slug === 'string' ? route.params.city_slug : ''))

const cityNameRu = ref('')

const search = ref('')
const pending = ref(true)
const errorMessage = ref<string | null>(null)
const shops = ref<ShopItem[]>([])
const listMode = ref<'delivery' | 'pickup'>('delivery')

const showModeSwitcher = computed(() => {
  const d = shops.value.some((s: ShopItem) => s.fulfillment?.delivery)
  const p = shops.value.some((s: ShopItem) => s.fulfillment?.pickup)
  return d && p
})

function shopMatchesMode(shop: ShopItem): boolean {
  const f = shop.fulfillment
  if (!f) return true
  return listMode.value === 'delivery' ? f.delivery : f.pickup
}

const filteredByMode = computed(() => shops.value.filter((s) => shopMatchesMode(s)))

const displayShops = computed(() => {
  const q = search.value.toLowerCase()
  const base = filteredByMode.value
  if (!q) return base
  return base.filter((s) => s.name.toLowerCase().includes(q))
})

const pickupMapPoints = computed(() => {
  const seen = new Set<string>()
  const out: PickupPoint[] = []
  for (const s of filteredByMode.value) {
    for (const p of s.pickupPoints ?? []) {
      const k = `${p.name.trim()}|${p.address.trim()}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(p)
    }
  }
  return out
})

/** Google Maps embed (без API-ключа) — ориентир по запросу. */
const pickupMapEmbedUrl = computed(() => {
  const pts = pickupMapPoints.value
  if (!pts.length) return ''
  const q = pts.length === 1
    ? pts[0].address
    : [cityNameRu.value, pts[0].address].filter(Boolean).join(', ')
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
})

function yandexMapsLink(address: string) {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`
}

watch(listMode, (mode: 'delivery' | 'pickup') => {
  if (typeof window === 'undefined') return
  const slug = citySlug.value
  if (!slug) return
  try {
    localStorage.setItem(`teleshop-city-fulfillment:${slug}`, mode)
  } catch {
    // ignore
  }
})

function pickInitialListMode(list: ShopItem[]): 'delivery' | 'pickup' {
  const canD = list.some((s) => s.fulfillment?.delivery)
  const canP = list.some((s) => s.fulfillment?.pickup)
  if (canD && !canP) return 'delivery'
  if (!canD && canP) return 'pickup'
  return 'delivery'
}

function restoreListMode(list: ShopItem[]) {
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
  try {
    const raw = localStorage.getItem(`teleshop-city-fulfillment:${slug}`)
    const canD = list.some((s) => s.fulfillment?.delivery)
    const canP = list.some((s) => s.fulfillment?.pickup)
    if (raw === 'delivery' || raw === 'pickup') {
      if (raw === 'delivery' && !canD && canP) {
        listMode.value = 'pickup'
        return
      }
      if (raw === 'pickup' && !canP && canD) {
        listMode.value = 'delivery'
        return
      }
      if ((raw === 'delivery' && canD) || (raw === 'pickup' && canP)) {
        listMode.value = raw
        return
      }
    }
  } catch {
    // ignore
  }
  listMode.value = pickInitialListMode(list)
}

watch(shops, (list: ShopItem[]) => {
  if (!list.length) return
  const canD = list.some((s: ShopItem) => s.fulfillment?.delivery)
  const canP = list.some((s: ShopItem) => s.fulfillment?.pickup)
  if (listMode.value === 'delivery' && !canD && canP) listMode.value = 'pickup'
  if (listMode.value === 'pickup' && !canP && canD) listMode.value = 'delivery'
}, { deep: true })

async function loadCityAndShops() {
  const slug = citySlug.value
  if (!slug) {
    cityNameRu.value = ''
    shops.value = []
    pending.value = false
    errorMessage.value = 'Город не указан в URL'
    return
  }

  pending.value = true
  errorMessage.value = null
  try {
    const [cityHttpRes, shopsHttpRes] = await Promise.all([
      fetch(`/api/cities?slug=${encodeURIComponent(slug)}`),
      fetch(`/api/shops?city_slug=${encodeURIComponent(slug)}`),
    ])

    if (!cityHttpRes.ok) {
      throw new Error('Не удалось загрузить город')
    }
    if (!shopsHttpRes.ok) {
      throw new Error('Не удалось загрузить рестораны')
    }

    const cityRes = await cityHttpRes.json() as CityResponse
    const shopsRes = await shopsHttpRes.json() as { ok: boolean, items: ShopItem[] }

    cityNameRu.value = cityRes.city?.name || slug
    if (!shopsRes.ok) {
      throw new Error('Не удалось загрузить рестораны')
    }
    shops.value = shopsRes.items ?? []
    restoreListMode(shops.value)
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка загрузки'
    cityNameRu.value = slug
    shops.value = []
  } finally {
    pending.value = false
  }
}

watch(citySlug, loadCityAndShops, { immediate: true })
</script>
