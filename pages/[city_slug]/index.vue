<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white/95 backdrop-blur">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 class="text-2xl font-bold text-gray-900">
          Рестораны в {{ cityNameRu }}
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          TeleShop — агрегатор. Доставку и готовку выполняет каждый ресторан самостоятельно.
        </p>
      </div>
    </header>

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
            v-for="shop in filteredShops"
            :key="shop.id"
            class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary"
          >
            <NuxtLink :to="`/${citySlug}/${shop.slug}`" class="block">
              <div class="flex items-start gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <span class="text-sm font-bold">{{ shop.name.slice(0, 1).toUpperCase() }}</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-gray-900">
                    {{ shop.name }}
                  </p>
                  <p class="mt-1 text-xs text-gray-500">
                    Перейти к меню
                  </p>
                </div>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <div v-if="!filteredShops.length" class="mt-6 text-sm text-gray-600">
          Ничего не найдено по запросу.
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type ShopItem = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  description: string | null
}

const route = useRoute()
const citySlug = computed(() => (typeof route.params.city_slug === 'string' ? route.params.city_slug : ''))

type CityResponse = {
  ok: boolean
  city: {
    id: string
    name: string
    slug: string
    isActive: boolean
  } | null
}

const cityNameRu = ref('')

const search = ref('')
const pending = ref(true)
const errorMessage = ref<string | null>(null)
const shops = ref<ShopItem[]>([])

const filteredShops = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return shops.value
  return shops.value.filter((s) => s.name.toLowerCase().includes(q))
})

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
    const shopsRes = await shopsHttpRes.json() as { ok: boolean; items: ShopItem[] }

    cityNameRu.value = cityRes.city?.name || slug
    if (!shopsRes.ok) {
      throw new Error('Не удалось загрузить рестораны')
    }
    shops.value = shopsRes.items ?? []
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
