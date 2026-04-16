<template>
  <div class="profile-page">
    <h1>Профиль</h1>

    <div class="card">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2>Данные пользователя</h2>
          <p class="hint">
            В mini app показываем всё, что уже знаем о пользователе из мессенджера, аккаунта и сохранённой анкеты.
          </p>
        </div>
        <span v-if="isMessengerMiniApp" class="badge badge-messenger">
          Mini App
        </span>
      </div>

      <dl class="info mt-4">
        <div>
          <dt>Имя</dt>
          <dd>{{ resolvedProfileName || 'Пока не указано' }}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>{{ profileForm.phone || 'Пока не указан' }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ resolvedEmail || 'Пока не указан' }}</dd>
        </div>
        <div>
          <dt>Telegram</dt>
          <dd>{{ telegramDisplay }}</dd>
        </div>
        <div>
          <dt>MAX</dt>
          <dd>{{ maxDisplay }}</dd>
        </div>
        <div v-if="messengerDebugLabel">
          <dt>Источник</dt>
          <dd>{{ messengerDebugLabel }}</dd>
        </div>
      </dl>

      <div v-if="!hasAnyProfileData" class="empty-state">
        <p class="font-medium text-gray-900">
          Пока о пользователе нет данных.
        </p>
        <p class="hint">
          Можно заполнить анкету ниже или запросить авторизацию через бота в один клик.
        </p>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          v-if="telegramBotUrl"
          type="button"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          @click="openTelegramAuth"
        >
          {{ isMessengerMiniApp ? 'Запросить данные через Telegram' : (telegramId !== null ? 'Перепривязать Telegram' : 'Войти через Telegram') }}
        </button>
        <button
          v-if="maxBotUrl"
          type="button"
          class="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary"
          @click="openMaxAuth"
        >
          {{ isMessengerMiniApp ? 'Запросить данные через MAX' : (maxUserId ? 'Перепривязать MAX' : 'Войти через MAX') }}
        </button>
        <button
          v-if="!isMessengerMiniApp && !user"
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          @click="showAuthModal = true"
        >
          Выбрать способ входа
        </button>
      </div>
    </div>

    <div class="card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2>Анкета для заказа</h2>
          <p class="hint">
            Эти данные можно заранее заполнить в mini app, чтобы оформление заказа было быстрее.
          </p>
        </div>
        <span v-if="saveStatus" class="text-xs text-gray-500">{{ saveStatus }}</span>
      </div>

      <div class="mt-4 grid gap-3">
        <label class="field">
          <span>Имя</span>
          <input
            v-model="profileForm.name"
            type="text"
            placeholder="Как к вам обращаться"
          >
        </label>
        <label class="field">
          <span>Телефон</span>
          <input
            v-model="profileForm.phone"
            type="tel"
            placeholder="+7 900 000-00-00"
          >
        </label>
        <label class="field">
          <span>Комментарий</span>
          <textarea
            v-model="profileForm.notes"
            rows="3"
            placeholder="Например: домофон, этаж, удобный способ связи"
          ></textarea>
        </label>
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isSaving"
          @click="saveProfileDraft"
        >
          {{ isSaving ? 'Сохраняем...' : 'Сохранить данные' }}
        </button>
        <button
          v-if="telegramBotUrl || maxBotUrl"
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          @click="showAuthModal = true"
        >
          Заполнить через бота
        </button>
      </div>
    </div>

    <template v-if="user">
      <div class="card">
        <h2>Бонусы по ресторанам</h2>
        <p class="hint mb-4">
          Показаны рестораны, где у вас есть начисленные бонусы (1 бонус = 1 б). Откройте ресторан, чтобы посмотреть детали на его странице.
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
                {{ row.balance }} б
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import { useRoute } from 'vue-router'
import { useTenant } from '../composables/useTenant'
import { useTelegram } from '../composables/useTelegram'
import { useMessengerStorage } from '../composables/useMessengerStorage'

declare const useRuntimeConfig: any
declare const navigateTo: (to: any) => Promise<void> | void

type BalanceRow = {
  shopId: string
  balance: number
  shopName: string
  tenantSlug: string
  citySlug: string
}

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()
const { tenantPath, tenantKey } = useTenant()
const config = useRuntimeConfig()
const { isMessengerMiniApp, isTelegram, isMaxMiniApp, messengerWebApp } = useTelegram()
const { canUseMessengerStorage, getItem, setItem } = useMessengerStorage()
const telegramBotName = (config.public.telegramBotName as string | undefined) || ''
const telegramBotUrl = computed(() => (telegramBotName ? `https://t.me/${telegramBotName}` : null))
const maxBotUrl = computed(() => {
  const raw = (config.public.maxBotUrl as string | undefined) || ''
  const trimmed = raw.trim()
  return trimmed || null
})
const showAuthModal = ref(false)
const isSaving = ref(false)
const saveStatus = ref('')

type ProfileDraft = {
  name: string
  phone: string
  notes: string
}

const PROFILE_DRAFT_STORAGE_KEY = 'teleshop_profile_draft'
const profileForm = reactive<ProfileDraft>({
  name: '',
  phone: '',
  notes: '',
})

const userId = computed<string | null>(() => {
  const raw = (user.value as any)?.sub
  return typeof raw === 'string' ? raw : null
})

const telegramId = computed<number | null>(() => {
  const raw = (user.value as any)?.user_metadata?.telegram_id
  return typeof raw === 'number' ? raw : null
})

const maxUserId = computed<string | null>(() => {
  const raw = (user.value as any)?.user_metadata?.max_user_id
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed || null
  }
  if (typeof raw === 'number') return String(raw)
  return null
})

const authMetadata = computed<Record<string, any>>(() => ((user.value as any)?.user_metadata ?? {}) as Record<string, any>)

const messengerUser = computed<Record<string, any> | null>(() => {
  const raw = messengerWebApp.value?.initDataUnsafe?.user
  return raw && typeof raw === 'object' ? (raw as Record<string, any>) : null
})

const resolvedEmail = computed<string | null>(() => {
  const raw = (user.value as any)?.email
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
})

const resolvedProfileName = computed<string>(() => {
  const candidates = [
    profileForm.name,
    authMetadata.value.full_name,
    authMetadata.value.name,
    authMetadata.value.first_name,
    [messengerUser.value?.first_name, messengerUser.value?.last_name].filter(Boolean).join(' '),
    messengerUser.value?.username ? `@${messengerUser.value.username}` : '',
  ]
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim()
  }
  return ''
})

const telegramDisplay = computed(() => {
  if (telegramId.value !== null) return `Привязан, ID ${telegramId.value}`
  if (isTelegram.value && messengerUser.value?.id) {
    const username = typeof messengerUser.value.username === 'string' && messengerUser.value.username.trim()
      ? ` (@${messengerUser.value.username.trim()})`
      : ''
    return `Mini App user ID ${messengerUser.value.id}${username}`
  }
  return 'Не подключён'
})

const maxDisplay = computed(() => {
  if (maxUserId.value) return `Привязан, ID ${maxUserId.value}`
  if (isMaxMiniApp.value && messengerUser.value?.id) {
    return `Mini App user ID ${messengerUser.value.id}`
  }
  return 'Не подключён'
})

const messengerDebugLabel = computed(() => {
  if (isTelegram.value) return 'Telegram Mini App'
  if (isMaxMiniApp.value) return 'MAX Mini App'
  if (user.value) return 'Аккаунт сайта'
  return ''
})

const hasAnyProfileData = computed(() => {
  return Boolean(
    resolvedProfileName.value
    || profileForm.phone.trim()
    || resolvedEmail.value
    || telegramId.value !== null
    || maxUserId.value
    || messengerUser.value?.id,
  )
})

function profileDraftStorageKey() {
  const shopRef =
    (typeof route.query.shop_id === 'string' && route.query.shop_id.trim())
    || tenantKey.value?.trim()
    || 'default'
  return `${PROFILE_DRAFT_STORAGE_KEY}:${shopRef}`
}

function applyDraft(draft: Partial<ProfileDraft> | null | undefined) {
  if (!draft || typeof draft !== 'object') return
  if (typeof draft.name === 'string') profileForm.name = draft.name
  if (typeof draft.phone === 'string') profileForm.phone = draft.phone
  if (typeof draft.notes === 'string') profileForm.notes = draft.notes
}

function hydrateProfileFormFromKnownSources() {
  if (!profileForm.name.trim()) {
    const fallbackName = [
      authMetadata.value.full_name,
      authMetadata.value.name,
      [messengerUser.value?.first_name, messengerUser.value?.last_name].filter(Boolean).join(' '),
    ].find((value) => typeof value === 'string' && value.trim())
    if (typeof fallbackName === 'string') profileForm.name = fallbackName.trim()
  }
  if (!profileForm.phone.trim() && typeof authMetadata.value.phone === 'string') {
    profileForm.phone = authMetadata.value.phone.trim()
  }
  if (!profileForm.notes.trim() && typeof authMetadata.value.order_notes === 'string') {
    profileForm.notes = authMetadata.value.order_notes.trim()
  }
}

async function loadProfileDraft() {
  let parsed: Partial<ProfileDraft> | null = null
  if (canUseMessengerStorage()) {
    try {
      const raw = await getItem(profileDraftStorageKey())
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }
  }
  if (!parsed && process.client) {
    try {
      const raw = localStorage.getItem(profileDraftStorageKey())
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }
  }
  applyDraft(parsed)
  hydrateProfileFormFromKnownSources()
}

async function persistProfileDraft(draft: ProfileDraft) {
  const data = JSON.stringify(draft)
  if (process.client) {
    try {
      localStorage.setItem(profileDraftStorageKey(), data)
    } catch {
      // ignore
    }
  }
  if (canUseMessengerStorage()) {
    await setItem(profileDraftStorageKey(), data)
  }
}

async function saveProfileDraft() {
  isSaving.value = true
  saveStatus.value = ''
  const payload: ProfileDraft = {
    name: profileForm.name.trim(),
    phone: profileForm.phone.trim(),
    notes: profileForm.notes.trim(),
  }
  try {
    await persistProfileDraft(payload)
    if (user.value) {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...authMetadata.value,
          full_name: payload.name || null,
          phone: payload.phone || null,
          order_notes: payload.notes || null,
        },
      })
      if (error) throw error
    }
    saveStatus.value = 'Сохранено'
  } catch {
    saveStatus.value = 'Не удалось сохранить'
  } finally {
    isSaving.value = false
    setTimeout(() => {
      if (saveStatus.value === 'Сохранено') saveStatus.value = ''
    }, 2200)
  }
}

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

onMounted(() => {
  void loadProfileDraft()
})

watch([user, messengerUser], () => {
  hydrateProfileFormFromKnownSources()
}, { immediate: true })

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

async function openTelegramAuth() {
  showAuthModal.value = false
  if (!telegramBotUrl.value || typeof window === 'undefined') return
  const shopRef =
    (typeof route.query.shop_id === 'string' && route.query.shop_id.trim()) || tenantKey.value?.trim() || ''
  if (!shopRef) {
    window.alert('Откройте вход из витрины ресторана или добавьте ?shop_id= в адрес страницы.')
    return
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-telegram-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: tenantPath('/profile'),
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const tgUrl = `${telegramBotUrl.value}?start=${encodeURIComponent(res.botStartParam)}`
    window.open(tgUrl, '_blank', 'noopener')
    await navigateTo({
      path: '/link-telegram',
      query: {
        token: res.token,
        redirect: tenantPath('/profile'),
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через Telegram. Попробуйте ещё раз.')
  }
}

async function openMaxAuth() {
  showAuthModal.value = false
  if (!maxBotUrl.value || typeof window === 'undefined') return
  const shopRef =
    (typeof route.query.shop_id === 'string' && route.query.shop_id.trim()) || tenantKey.value?.trim() || ''
  if (!shopRef) {
    window.alert('Откройте вход из витрины ресторана или добавьте ?shop_id= в адрес страницы.')
    return
  }
  const citySlug = typeof route.params.city_slug === 'string' ? route.params.city_slug.trim() : ''
  try {
    const res = await $fetch<{ ok: boolean; token: string; botStartParam: string }>(
      '/api/auth/request-max-link',
      {
        method: 'POST',
        headers: { 'x-shop-id': shopRef },
        body: {
          shopId: shopRef,
          citySlug: citySlug || undefined,
          redirectPath: tenantPath('/profile'),
        },
      },
    )
    if (!res?.ok || !res.token || !res.botStartParam) {
      throw new Error('bad_response')
    }
    const hasQuery = maxBotUrl.value.includes('?')
    const maxUrl = `${maxBotUrl.value}${hasQuery ? '&' : '?'}start=${encodeURIComponent(res.botStartParam)}`
    window.open(maxUrl, '_blank', 'noopener')
    await navigateTo({
      path: '/link-max',
      query: {
        token: res.token,
        redirect: tenantPath('/profile'),
        shop_id: shopRef,
      },
    })
  } catch {
    window.alert('Не удалось начать вход через MAX. Попробуйте ещё раз.')
  }
}
</script>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  display: grid;
  gap: 1rem;
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

.badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-messenger {
  background: #eff6ff;
  color: #1d4ed8;
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

.field {
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #374151;
}

.field input,
.field textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  padding: 0.75rem 0.9rem;
  font-size: 0.95rem;
  color: #111827;
  background: #ffffff;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary, #2563eb);
  box-shadow: 0 0 0 1px var(--color-primary, #2563eb);
}

.empty-state {
  margin-top: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  padding: 0.9rem 1rem;
}
</style>
