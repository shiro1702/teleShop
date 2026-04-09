<template>
  <div class="profile-page">
    <h1>Профиль</h1>

    <div v-if="!user" class="card">
      <p>Вы ещё не вошли на сайт.</p>
      <p class="hint">
        Выберите способ входа: Telegram или MAX.
      </p>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white" @click="showAuthModal = true">
          Войти
        </button>
      </div>
    </div>

    <template v-else>
      <div class="card">
        <h2>Текущий пользователь</h2>
        <dl class="info">
          <div>
            <dt>User ID</dt>
            <dd>{{ userId }}</dd>
          </div>
          <div v-if="telegramId !== null">
            <dt>Telegram ID</dt>
            <dd>{{ telegramId }}</dd>
          </div>
          <div v-else>
            <dt>Telegram</dt>
            <dd>Ещё не привязан</dd>
          </div>
        </dl>
        <p class="hint">
          Telegram‑аккаунт привязывается через бота и страницу привязки, после чего заказы с сайта будут
          уведомлять вас в Telegram.
        </p>
      </div>

      <div class="card">
        <h2>Бонусы по ресторанам</h2>
        <p class="hint mb-4">
          Показаны рестораны, где у вас есть начисленные бонусы (1 бонус = 1 ₽). Откройте ресторан, чтобы посмотреть детали на его странице.
        </p>

        <label class="block text-sm font-medium text-gray-700">
          Поиск по названию
          <input
            v-model="searchInput"
            type="search"
            placeholder="Название ресторана…"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autocomplete="off"
          >
        </label>

        <p v-if="listLoading" class="mt-4 text-sm text-gray-500">
          Загрузка…
        </p>
        <p v-else-if="listError" class="mt-4 text-sm text-red-600">
          {{ listError }}
        </p>
        <p v-else-if="total === 0 && !debouncedSearch" class="mt-4 text-sm text-gray-500">
          Пока нет бонусов ни в одном ресторане. Они появятся после оплаченных заказов с начислением бонусов.
        </p>
        <p v-else-if="total === 0 && debouncedSearch" class="mt-4 text-sm text-gray-500">
          Ничего не найдено по запросу «{{ debouncedSearch }}».
        </p>

        <ul v-else class="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          <li
            v-for="row in items"
            :key="row.shopId"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-gray-900">
                {{ row.shopName }}
              </p>
              <p class="text-xs text-gray-500">
                Баланс в этом ресторане
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span class="text-lg font-semibold tabular-nums text-gray-900">
                {{ row.balance }} ₽
              </span>
              <NuxtLink
                :to="`/${row.citySlug}/${row.tenantSlug}/bonuses`"
                class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Открыть
              </NuxtLink>
            </div>
          </li>
        </ul>

        <div
          v-if="total > pageSize"
          class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"
        >
          <p class="text-sm text-gray-500">
            {{ pageFrom }}–{{ pageTo }} из {{ total }}
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
              :disabled="page <= 1 || listLoading"
              @click="page--"
            >
              Назад
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
              :disabled="page >= totalPages || listLoading"
              @click="page++"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
  <Teleport to="body">
    <div v-if="showAuthModal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="showAuthModal = false" />
      <div class="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        <h3 class="text-base font-semibold text-gray-900">Выберите способ входа</h3>
        <div class="mt-4 space-y-2">
          <button v-if="telegramBotUrl" type="button" class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white" @click="openTelegramAuth">
            Войти через Telegram
          </button>
          <button v-if="maxBotUrl" type="button" class="w-full rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary" @click="openMaxAuth">
            Войти через MAX
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useSupabaseUser } from '#imports'
import { useRoute } from 'vue-router'
declare const useRuntimeConfig: any

type BalanceRow = {
  shopId: string
  balance: number
  shopName: string
  tenantSlug: string
  citySlug: string
}

const user = useSupabaseUser()
const route = useRoute()
const config = useRuntimeConfig()
const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() => (telegramBotName ? `https://t.me/${telegramBotName}` : null))
const maxBotUrl = computed(() => {
  const raw = (config.public.maxBotUrl as string | undefined) || ''
  const trimmed = raw.trim()
  return trimmed || null
})
const showAuthModal = ref(false)

const userId = computed<string | null>(() => {
  const raw = (user.value as any)?.sub
  return typeof raw === 'string' ? raw : null
})

const telegramId = computed<number | null>(() => {
  const raw = (user.value as any)?.user_metadata?.telegram_id
  return typeof raw === 'number' ? raw : null
})

const searchInput = ref('')
const debouncedSearch = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (v: string) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = typeof v === 'string' ? v.trim() : ''
    page.value = 1
  }, 320)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const page = ref(1)
const pageSize = 10

const items = ref<BalanceRow[]>([])
const total = ref(0)
const listLoading = ref(false)
const listError = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const pageFrom = computed(() => {
  if (total.value === 0) return 0
  return (page.value - 1) * pageSize + 1
})

const pageTo = computed(() => Math.min(page.value * pageSize, total.value))

async function loadList() {
  if (!user.value) {
    items.value = []
    total.value = 0
    return
  }
  listLoading.value = true
  listError.value = ''
  try {
    const q = debouncedSearch.value
    const res = await $fetch<{
      ok: boolean
      items: BalanceRow[]
      total: number
      page: number
      pageSize: number
    }>('/api/loyalty/balances', {
      query: {
        q: q || undefined,
        page: page.value,
        pageSize,
      },
    })
    if (res.total > 0 && res.items.length === 0 && page.value > 1) {
      page.value = 1
      return
    }
    items.value = res.items
    total.value = res.total
  } catch (e: any) {
    listError.value =
      typeof e?.data?.statusMessage === 'string'
        ? e.data.statusMessage
        : 'Не удалось загрузить список'
    items.value = []
    total.value = 0
  } finally {
    listLoading.value = false
  }
}

watch([user, page, debouncedSearch], () => {
  void loadList()
}, { immediate: true })

function openTelegramAuth() {
  showAuthModal.value = false
  if (!telegramBotUrl.value || typeof window === 'undefined') return
  const shopRef = typeof route.query.shop_id === 'string' ? route.query.shop_id.trim() : ''
  const url = `${telegramBotUrl.value}?start=auth_link${shopRef ? `_${encodeURIComponent(shopRef)}` : ''}`
  window.open(url, '_blank', 'noopener')
}

function openMaxAuth() {
  showAuthModal.value = false
  if (!maxBotUrl.value || typeof window === 'undefined') return
  const shopRef = typeof route.query.shop_id === 'string' ? route.query.shop_id.trim() : ''
  const startParam = `auth_link${shopRef ? `_${encodeURIComponent(shopRef)}` : ''}`
  const hasQuery = maxBotUrl.value.includes('?')
  const url = `${maxBotUrl.value}${hasQuery ? '&' : '?'}start=${encodeURIComponent(startParam)}`
  window.open(url, '_blank', 'noopener')
}
</script>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
}

.card {
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 1.5rem;
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.info {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.info dt {
  font-weight: 500;
  color: #4b5563;
}

.info dd {
  margin: 0;
  color: #111827;
}

.hint {
  font-size: 0.85rem;
  color: #6b7280;
}
</style>
