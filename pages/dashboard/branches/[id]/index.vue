<template>
  <section v-if="branch" class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Карточка филиала</h1>
        <p class="mt-1 text-sm text-gray-600">{{ branch.name }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <NuxtLink
            v-if="branch"
            :to="`/dashboard/branches/${branch.id}/kitchen`"
            class="text-sm text-primary hover:underline"
          >
            Экран кухни (KDS)
          </NuxtLink>
          <NuxtLink
            v-if="branch"
            :to="`/dashboard/branches/${branch.id}/zones`"
            class="text-sm text-primary hover:underline"
          >
            Зоны доставки
          </NuxtLink>
          <NuxtLink
            v-if="branch && storefrontPath"
            :to="{ path: storefrontPath, query: { branch_id: branch.id } }"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Витрина · этот филиал
          </NuxtLink>
        </div>
      </div>
      <span class="rounded-full px-2.5 py-1 text-xs font-medium" :class="branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'">
        {{ branch.isActive ? 'Active' : 'Inactive' }}
      </span>
    </div>

    <div v-if="branch && storefrontPath" class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-gray-900">QR для гостей</h2>
      <p class="mt-1 text-xs text-gray-500">
        Ссылка ведёт на витрину с выбранным филиалом. Параметр
        <code class="rounded bg-gray-100 px-1">qr=1</code>
        отмечает переход с QR-стикера (можно отфильтровать в аналитике).
      </p>
      <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            width="220"
            height="220"
            class="h-[220px] w-[220px]"
            alt="QR-код ссылки на витрину филиала"
          >
          <p v-else class="flex h-[220px] w-[220px] items-center justify-center text-xs text-gray-400">
            Генерация…
          </p>
        </div>
        <div class="min-w-0 flex-1 space-y-2 text-sm">
          <p class="break-all rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-800">
            {{ branchQrUrl || '—' }}
          </p>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            :disabled="!branchQrUrl"
            @click="copyBranchQrUrl"
          >
            {{ copyFeedback || 'Скопировать ссылку' }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="branch && storefrontPath" class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-gray-900">Столики и QR</h2>
      <p class="mt-1 text-xs text-gray-500">
        Для каждого столика генерируется отдельная QR-ссылка с контекстом столика.
      </p>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          v-model="newTableNumber"
          class="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm sm:max-w-xs"
          placeholder="Номер столика, например 12"
          :disabled="!canEditCritical || creatingTable"
        >
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          :disabled="!canEditCritical || creatingTable || !newTableNumber.trim()"
          @click="createTable"
        >
          {{ creatingTable ? 'Добавляем...' : 'Добавить столик' }}
        </button>
      </div>
      <div class="mt-2 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
        <label class="text-xs text-gray-600">
          <span class="mb-1 block">От</span>
          <input
            v-model.number="bulkFrom"
            type="number"
            min="1"
            class="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            :disabled="!canEditCritical || creatingBulkTables"
          >
        </label>
        <label class="text-xs text-gray-600">
          <span class="mb-1 block">До</span>
          <input
            v-model.number="bulkTo"
            type="number"
            min="1"
            class="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            :disabled="!canEditCritical || creatingBulkTables"
          >
        </label>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-white disabled:opacity-50"
          :disabled="!canEditCritical || creatingBulkTables"
          @click="createTablesBulk"
        >
          {{ creatingBulkTables ? 'Генерируем...' : 'Сгенерировать диапазон столиков' }}
        </button>
      </div>
      <p v-if="tablesError" class="mt-2 text-xs text-red-600">{{ tablesError }}</p>
      <div class="mt-4 space-y-2">
        <div
          v-for="table in tables"
          :key="table.id"
          class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center"
        >
          <div class="rounded border border-gray-200 bg-white p-1.5">
            <img
              v-if="tableQrDataById[table.id]"
              :src="tableQrDataById[table.id]"
              width="84"
              height="84"
              class="h-[84px] w-[84px]"
              :alt="`QR для столика №${table.tableNumber}`"
            >
            <div v-else class="flex h-[84px] w-[84px] items-center justify-center text-[10px] text-gray-400">
              QR...
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900">Столик №{{ table.tableNumber }}</p>
            <p class="break-all text-xs text-gray-500">{{ buildTableQrUrl(table) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-50"
              :disabled="!buildTableQrUrl(table)"
              @click="copyTableQrUrl(table)"
            >
              {{ copyFeedbackByTableId[table.id] || 'Скопировать QR-ссылку' }}
            </button>
            <button
              type="button"
              class="rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-50"
              :class="table.isActive ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'"
              :disabled="!canEditCritical || updatingTableId === table.id"
              @click="toggleTableActive(table)"
            >
              {{ table.isActive ? 'Деактивировать' : 'Активировать' }}
            </button>
          </div>
        </div>
        <p v-if="!tables.length" class="text-xs text-gray-500">Пока нет столиков.</p>
      </div>
    </div>

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Название</span>
        <input v-model="form.name" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="!canEditCritical">
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Адрес</span>
        <div class="relative">
          <input
            v-model="form.address"
            class="w-full rounded-lg border border-gray-300 px-2 py-2"
            :disabled="!canEditCritical"
            @input="onAddressInput"
          >
          <div
            v-if="isSuggestLoading"
            class="pointer-events-none absolute inset-y-0 right-2 flex items-center"
          >
            <svg class="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
          <div
            v-if="suggestItems.length && canEditCritical"
            class="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <button
              v-for="item in suggestItems"
              :key="item.value"
              type="button"
              class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-800 transition hover:bg-gray-50"
              @click="pickSuggestion(item)"
            >
              <span class="truncate">{{ item.displayName }}</span>
            </button>
          </div>
        </div>
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsDelivery" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('delivery')">
        Доставка
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsPickup" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('pickup')">
        Самовывоз
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
        <input v-model="form.supportsDineIn" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('dine-in')">
        В зале
      </label>
      <template v-if="form.supportsDineIn && allowedModesSet.has('dine-in')">
        <label
          v-if="orgDineInHallMode === 'to-table'"
          class="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2"
        >
          <input v-model="form.supportsQrMenu" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical">
          Заказы до столика (QR со столика)
        </label>
        <label
          v-if="orgDineInHallMode === 'pickup-point'"
          class="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2"
        >
          <input v-model="form.supportsShowcaseOrder" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical">
          Заказ на общую выдачу (по QR)
        </label>
        <p v-if="orgDineInHallMode === 'qr-menu-browse'" class="md:col-span-2 text-xs text-gray-500">
          В организации включён только просмотр меню в зале — заказы через филиал не настраиваются.
        </p>
      </template>
      <div class="md:col-span-2">
        <div class="mb-3 rounded border border-gray-200 bg-gray-50 p-3">
          <p class="text-sm font-medium text-gray-700">График работы филиала</p>
          <p class="mt-1 text-xs text-gray-500">
            Можно использовать общий график ресторана или задать свой для этого филиала.
          </p>
          <label class="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="form.useOrganizationWorkingHours"
              type="checkbox"
              class="rounded border-gray-300"
              :disabled="!canEditCritical"
            >
            Использовать общий график ресторана
          </label>
          <div v-if="!form.useOrganizationWorkingHours" class="mt-3 space-y-2">
            <div
              v-for="day in workingDayRows"
              :key="day.key"
              class="grid items-center gap-2 rounded border border-gray-200 bg-white px-2 py-2 md:grid-cols-[120px,120px,1fr,1fr]"
            >
              <span class="text-sm text-gray-700">{{ day.label }}</span>
              <label class="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  v-model="form.workingHours[day.key].isOpen"
                  type="checkbox"
                  :disabled="!canEditCritical"
                >
                Открыто
              </label>
              <label class="text-sm">
                <span class="mb-1 block text-xs text-gray-500">Открытие</span>
                <input
                  v-model="form.workingHours[day.key].openAt"
                  type="time"
                  class="w-full rounded border border-gray-300 px-2 py-1.5"
                  :disabled="!canEditCritical || !form.workingHours[day.key].isOpen"
                >
              </label>
              <label class="text-sm">
                <span class="mb-1 block text-xs text-gray-500">Закрытие</span>
                <input
                  v-model="form.workingHours[day.key].closeAt"
                  type="time"
                  class="w-full rounded border border-gray-300 px-2 py-1.5"
                  :disabled="!canEditCritical || !form.workingHours[day.key].isOpen"
                >
              </label>
            </div>
          </div>
        </div>
        <p class="mb-2 text-xs text-gray-500">
          В филиале доступны только те способы работы, которые включены в общих настройках ресторана.
        </p>
        <p v-if="!canEditCritical" class="mb-2 text-xs text-amber-700">Критичные поля доступны только Owner.</p>
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" :disabled="!canEditCritical" @click="save">
          Сохранить
        </button>
        <button class="ml-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" :disabled="!canEditCritical" @click="deactivate">
          Деактивировать
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">История изменений</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(log, idx) in logs" :key="idx" class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
          <span>{{ log.action }}</span>
          <span class="text-gray-500">{{ log.at }}</span>
        </li>
      </ul>
    </div>
  </section>

  <section
    v-else-if="loading"
    class="space-y-4"
    aria-busy="true"
    aria-label="Загрузка карточки филиала"
  >
    <div class="animate-pulse">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-2">
          <div class="h-8 w-56 rounded-lg bg-gray-200" />
          <div class="h-4 w-40 rounded bg-gray-100" />
          <div class="flex gap-3 pt-1">
            <div class="h-4 w-28 rounded bg-gray-100" />
            <div class="h-4 w-24 rounded bg-gray-100" />
            <div class="h-8 w-36 rounded-lg bg-gray-200" />
          </div>
        </div>
        <div class="h-6 w-16 rounded-full bg-gray-100" />
      </div>
    </div>

    <div class="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div class="h-4 w-32 rounded bg-gray-200" />
      <div class="mt-3 h-3 w-full max-w-md rounded bg-gray-100" />
      <div class="mt-4 flex flex-col gap-4 sm:flex-row">
        <div class="h-[220px] w-[220px] rounded-lg bg-gray-100" />
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-10 w-full rounded-lg bg-gray-100" />
          <div class="h-9 w-36 rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>

    <div class="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div class="h-4 w-36 rounded bg-gray-200" />
      <div class="mt-3 h-10 w-full max-w-xs rounded-lg bg-gray-100" />
      <div class="mt-2 h-16 w-full rounded-lg bg-gray-50" />
    </div>

    <div class="animate-pulse grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
      <div class="h-16 rounded-lg bg-gray-100" />
      <div class="h-16 rounded-lg bg-gray-100" />
      <div class="h-5 w-28 rounded bg-gray-100" />
      <div class="h-5 w-28 rounded bg-gray-100" />
      <div class="md:col-span-2 space-y-2">
        <div class="h-24 rounded-lg bg-gray-50" />
        <div class="flex gap-2">
          <div class="h-9 w-24 rounded-lg bg-gray-200" />
          <div class="h-9 w-32 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>

    <div class="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div class="h-4 w-44 rounded bg-gray-200" />
      <div class="mt-3 space-y-2">
        <div class="h-8 rounded bg-gray-50" />
        <div class="h-8 rounded bg-gray-50" />
      </div>
    </div>
  </section>

  <section v-else>
    <h1 class="text-2xl font-semibold">Филиал не найден</h1>
    <p class="mt-2 text-sm text-gray-600">Проверьте ссылку или вернитесь к списку филиалов.</p>
    <NuxtLink to="/dashboard/branches" class="mt-4 inline-block text-sm text-primary hover:underline">
      К списку филиалов
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDashboardAccess } from '../../../../composables/useDashboardAccess'
import { dadataSuggest, type DadataSuggestItem } from '~/utils/dadataApi'

declare const definePageMeta: (meta: Record<string, unknown>) => void
declare const useRoute: () => { params: Record<string, string | string[] | undefined> }
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const { role } = useDashboardAccess()
const canEditCritical = computed(() => role.value === 'owner')

type Branch = {
  id: string
  name: string
  address: string
  lat: number | null
  lon: number | null
  supportsDelivery: boolean
  supportsPickup: boolean
  supportsDineIn: boolean
  supportsQrMenu: boolean
  supportsShowcaseOrder: boolean
  useOrganizationWorkingHours: boolean
  workingHours: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { isOpen: boolean; openAt: string; closeAt: string }>
  isActive: boolean
}
type RestaurantTable = {
  id: string
  tableNumber: string
  qrSlug: string
  isActive: boolean
}

const loading = ref(true)
const branch = ref<Branch | null>(null)
const form = ref({
  name: '',
  address: '',
  lat: null as number | null,
  lon: null as number | null,
  supportsDelivery: false,
  supportsPickup: false,
  supportsDineIn: false,
  supportsQrMenu: false,
  supportsShowcaseOrder: false,
  useOrganizationWorkingHours: true,
  workingHours: {
    mon: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    tue: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    wed: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    thu: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    fri: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    sat: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
    sun: { isOpen: true, openAt: '09:00', closeAt: '22:00' },
  },
})
const logs = ref<Array<{ action: string; at: string }>>([])
const allowedModes = ref<Array<'delivery' | 'pickup' | 'dine-in'>>(['delivery', 'pickup'])
const allowedModesSet = computed(() => new Set(allowedModes.value))
const orgDineInHallMode = ref<'qr-menu-browse' | 'to-table' | 'pickup-point'>('to-table')
const workingDayRows: Array<{ key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
]

const storefrontPath = ref('')
const qrDataUrl = ref<string | null>(null)
const copyFeedback = ref('')
const suggestItems = ref<DadataSuggestItem[]>([])
const isSuggestLoading = ref(false)
const tables = ref<RestaurantTable[]>([])
const newTableNumber = ref('')
const creatingTable = ref(false)
const updatingTableId = ref('')
const tablesError = ref('')
const copyFeedbackByTableId = ref<Record<string, string>>({})
const tableQrDataById = ref<Record<string, string>>({})
const bulkFrom = ref(1)
const bulkTo = ref(20)
const creatingBulkTables = ref(false)

const branchQrUrl = computed(() => {
  if (!import.meta.client || !branch.value || !storefrontPath.value) return ''
  try {
    const u = new URL(storefrontPath.value, window.location.origin)
    u.searchParams.set('branch_id', branch.value.id)
    u.searchParams.set('qr', '1')
    return u.toString()
  } catch {
    return ''
  }
})

watch(
  [branch, storefrontPath, branchQrUrl],
  async () => {
    if (!import.meta.client || !branchQrUrl.value) {
      qrDataUrl.value = null
      return
    }
    try {
      const QRCode = (await import('qrcode')).default
      qrDataUrl.value = await QRCode.toDataURL(branchQrUrl.value, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
    } catch {
      qrDataUrl.value = null
    }
  },
  { immediate: true },
)

async function copyBranchQrUrl() {
  const t = branchQrUrl.value
  if (!t || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(t)
    copyFeedback.value = 'Скопировано'
    window.setTimeout(() => {
      copyFeedback.value = ''
    }, 2000)
  } catch {
    copyFeedback.value = 'Не удалось скопировать'
    window.setTimeout(() => {
      copyFeedback.value = ''
    }, 2500)
  }
}

function buildTableQrUrl(table: RestaurantTable): string {
  if (!import.meta.client || !branch.value || !storefrontPath.value) return ''
  try {
    const u = new URL(storefrontPath.value, window.location.origin)
    u.searchParams.set('branch_id', branch.value.id)
    u.searchParams.set('qr', '1')
    u.searchParams.set('table_slug', table.qrSlug)
    u.searchParams.set('table_number', table.tableNumber)
    return u.toString()
  } catch {
    return ''
  }
}

async function copyTableQrUrl(table: RestaurantTable) {
  const text = buildTableQrUrl(table)
  if (!text || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(text)
    copyFeedbackByTableId.value = { ...copyFeedbackByTableId.value, [table.id]: 'Скопировано' }
  } catch {
    copyFeedbackByTableId.value = { ...copyFeedbackByTableId.value, [table.id]: 'Не удалось скопировать' }
  }
  window.setTimeout(() => {
    const next = { ...copyFeedbackByTableId.value }
    delete next[table.id]
    copyFeedbackByTableId.value = next
  }, 2000)
}

async function loadTables() {
  if (!branch.value) return
  tablesError.value = ''
  try {
    const res = await fetch(`/api/dashboard/branches/${branch.value.id}/tables`)
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      tables.value = []
      tablesError.value = payload?.statusMessage || 'Не удалось загрузить столики'
      return
    }
    tables.value = Array.isArray(payload?.items) ? payload.items : []
    void rebuildTableQrData()
  } catch {
    tables.value = []
    tablesError.value = 'Ошибка сети при загрузке столиков. Проверьте соединение и обновите страницу.'
  }
}

async function createTable() {
  if (!branch.value || !canEditCritical.value || creatingTable.value) return
  creatingTable.value = true
  tablesError.value = ''
  try {
    const res = await fetch(`/api/dashboard/branches/${branch.value.id}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: newTableNumber.value.trim() }),
    })
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok || !payload?.item) {
      throw new Error(payload?.statusMessage || 'Не удалось добавить столик')
    }
    tables.value = [...tables.value, payload.item].sort((a: RestaurantTable, b: RestaurantTable) => a.tableNumber.localeCompare(b.tableNumber, 'ru'))
    newTableNumber.value = ''
    void rebuildTableQrData()
  } catch (error: any) {
    tablesError.value = error?.message || 'Не удалось добавить столик'
  } finally {
    creatingTable.value = false
  }
}

async function createTablesBulk() {
  if (!branch.value || !canEditCritical.value || creatingBulkTables.value) return
  const from = Math.max(1, Math.floor(Number(bulkFrom.value || 0)))
  const to = Math.max(1, Math.floor(Number(bulkTo.value || 0)))
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    tablesError.value = 'Некорректный диапазон столиков'
    return
  }
  if (to - from + 1 > 200) {
    tablesError.value = 'Слишком большой диапазон (макс. 200 за раз)'
    return
  }
  creatingBulkTables.value = true
  tablesError.value = ''
  let createdCount = 0
  let skippedCount = 0
  try {
    for (let n = from; n <= to; n += 1) {
      const res = await fetch(`/api/dashboard/branches/${branch.value.id}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: String(n) }),
      })
      const payload = await res.json().catch(() => ({} as any))
      if (res.ok && payload?.item) {
        createdCount += 1
        tables.value = [...tables.value, payload.item]
      } else {
        skippedCount += 1
      }
    }
    tables.value = tables.value
      .sort((a: RestaurantTable, b: RestaurantTable) => a.tableNumber.localeCompare(b.tableNumber, 'ru'))
      .filter((item: RestaurantTable, idx: number, arr: RestaurantTable[]) => idx === arr.findIndex((x: RestaurantTable) => x.id === item.id))
    void rebuildTableQrData()
    if (createdCount === 0) {
      tablesError.value = 'Не удалось добавить столики: возможно, они уже существуют'
    } else if (skippedCount > 0) {
      tablesError.value = `Добавлено: ${createdCount}. Пропущено: ${skippedCount} (уже существуют или ошибка).`
    } else {
      tablesError.value = `Успешно добавлено столиков: ${createdCount}`
    }
  } finally {
    creatingBulkTables.value = false
  }
}

async function toggleTableActive(table: RestaurantTable) {
  if (!branch.value || !canEditCritical.value || updatingTableId.value) return
  updatingTableId.value = table.id
  tablesError.value = ''
  try {
    const res = await fetch(`/api/dashboard/branches/${branch.value.id}/tables/${table.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !table.isActive }),
    })
    const payload = await res.json().catch(() => ({} as any))
    if (!res.ok || !payload?.item) {
      throw new Error(payload?.statusMessage || 'Не удалось обновить столик')
    }
    tables.value = tables.value.map((item: RestaurantTable) => (item.id === table.id ? payload.item : item))
    void rebuildTableQrData()
  } catch (error: any) {
    tablesError.value = error?.message || 'Не удалось обновить столик'
  } finally {
    updatingTableId.value = ''
  }
}

async function rebuildTableQrData() {
  if (!import.meta.client || !tables.value.length) {
    tableQrDataById.value = {}
    return
  }
  try {
    const QRCode = (await import('qrcode')).default
    const entries = await Promise.all(
      tables.value.map(async (table: RestaurantTable) => {
        const url = buildTableQrUrl(table)
        if (!url) return [table.id, ''] as const
        const dataUrl = await QRCode.toDataURL(url, { width: 84, margin: 1, errorCorrectionLevel: 'M' })
        return [table.id, dataUrl] as const
      }),
    )
    tableQrDataById.value = Object.fromEntries(entries.filter((entry: readonly [string, string]) => entry[1]))
  } catch {
    tableQrDataById.value = {}
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [restaurantsRes, orgRes, storefrontRes] = await Promise.all([
      fetch('/api/dashboard/restaurants'),
      fetch('/api/dashboard/organization/style'),
      fetch('/api/dashboard/storefront'),
    ])
    if (storefrontRes.ok) {
      const sf = (await storefrontRes.json()) as { ok?: boolean; path?: string }
      if (sf?.ok && typeof sf.path === 'string' && sf.path.trim()) {
        storefrontPath.value = sf.path.trim()
      }
    }
    if (orgRes.ok) {
      const orgPayload = await orgRes.json() as {
        settings?: {
          ops?: {
            fulfillmentTypes?: Array<'delivery' | 'pickup' | 'dine-in'>
            dineInHallMode?: 'qr-menu-browse' | 'to-table' | 'pickup-point'
          }
        }
      }
      const modes = orgPayload.settings?.ops?.fulfillmentTypes
      if (Array.isArray(modes) && modes.length) allowedModes.value = modes
      const hall = orgPayload.settings?.ops?.dineInHallMode
      if (hall === 'qr-menu-browse' || hall === 'to-table' || hall === 'pickup-point') {
        orgDineInHallMode.value = hall
      }
    }
    if (!restaurantsRes.ok) return
    const payload = await restaurantsRes.json() as { items?: Branch[] }
    const found = (payload.items || []).find((item) => item.id === String(route.params.id)) || null
    branch.value = found
    if (found) {
      form.value = {
        name: found.name,
        address: found.address,
        lat: found.lat,
        lon: found.lon,
        supportsDelivery: found.supportsDelivery && allowedModesSet.value.has('delivery'),
        supportsPickup: found.supportsPickup && allowedModesSet.value.has('pickup'),
        supportsDineIn: found.supportsDineIn && allowedModesSet.value.has('dine-in'),
        supportsQrMenu: found.supportsQrMenu,
        supportsShowcaseOrder: found.supportsShowcaseOrder,
        useOrganizationWorkingHours: found.useOrganizationWorkingHours !== false,
        workingHours: found.workingHours,
      }
      await loadTables()
    }
  } finally {
    loading.value = false
  }
})

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function save() {
  if (!branch.value || !canEditCritical.value) return
  const res = await fetch(`/api/dashboard/branches/${branch.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.value.name.trim(),
      address: form.value.address.trim(),
      lat: form.value.lat,
      lon: form.value.lon,
      supportsDelivery: allowedModesSet.value.has('delivery') && form.value.supportsDelivery,
      supportsPickup: allowedModesSet.value.has('pickup') && form.value.supportsPickup,
      supportsDineIn: allowedModesSet.value.has('dine-in') && form.value.supportsDineIn,
      supportsQrMenu: allowedModesSet.value.has('dine-in') && orgDineInHallMode.value === 'to-table' && form.value.supportsQrMenu,
      supportsShowcaseOrder: allowedModesSet.value.has('dine-in') && orgDineInHallMode.value === 'pickup-point' && form.value.supportsShowcaseOrder,
      useOrganizationWorkingHours: form.value.useOrganizationWorkingHours,
      workingHours: form.value.workingHours,
    }),
  })
  if (!res.ok) {
    logs.value.unshift({ action: 'Ошибка сохранения настроек филиала', at: now() })
    return
  }
  const payload = await res.json() as { item?: Branch }
  if (!payload.item) return
  branch.value = payload.item
  form.value = {
    name: payload.item.name,
    address: payload.item.address,
    lat: payload.item.lat,
    lon: payload.item.lon,
    supportsDelivery: payload.item.supportsDelivery,
    supportsPickup: payload.item.supportsPickup,
    supportsDineIn: payload.item.supportsDineIn,
    supportsQrMenu: payload.item.supportsQrMenu,
    supportsShowcaseOrder: payload.item.supportsShowcaseOrder,
    useOrganizationWorkingHours: payload.item.useOrganizationWorkingHours !== false,
    workingHours: payload.item.workingHours,
  }
  logs.value.unshift({ action: 'Обновлены данные филиала', at: now() })
}

async function deactivate() {
  if (!branch.value || !canEditCritical.value) return
  const confirmed = window.confirm(`Деактивировать филиал "${branch.value.name}"?`)
  if (!confirmed) return
  const res = await fetch(`/api/dashboard/branches/${branch.value.id}/deactivate`, { method: 'POST' })
  if (!res.ok) {
    logs.value.unshift({ action: 'Ошибка деактивации филиала', at: now() })
    return
  }
  branch.value.isActive = false
  logs.value.unshift({ action: 'Филиал деактивирован', at: now() })
}

function onAddressInput() {
  if (!canEditCritical.value) return
  form.value.lat = null
  form.value.lon = null
  const query = form.value.address.trim()
  suggestItems.value = []
  if (query.length < 3) {
    isSuggestLoading.value = false
    return
  }
  const fn = onAddressInput as ((...args: unknown[]) => unknown) & { _timer?: ReturnType<typeof setTimeout> }
  if (fn._timer) clearTimeout(fn._timer)
  fn._timer = setTimeout(async () => {
    isSuggestLoading.value = true
    try {
      const currentQuery = form.value.address.trim()
      if (currentQuery.length < 3) {
        suggestItems.value = []
        return
      }
      suggestItems.value = await dadataSuggest(currentQuery)
    } finally {
      isSuggestLoading.value = false
    }
  }, 400)
}

function pickSuggestion(item: DadataSuggestItem) {
  form.value.address = item.displayName
  form.value.lat = item.lat
  form.value.lon = item.lon
  suggestItems.value = []
  isSuggestLoading.value = false
}
</script>
