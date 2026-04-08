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

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Название</span>
        <input v-model="form.name" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="!canEditCritical">
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Адрес</span>
        <input v-model="form.address" class="w-full rounded-lg border border-gray-300 px-2 py-2" :disabled="!canEditCritical">
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsDelivery" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('delivery')">
        Доставка
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsPickup" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('pickup')">
        Самовывоз
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsDineIn" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('dine-in')">
        В зале
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsQrMenu" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('qr-menu')">
        QR-меню
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
        <input v-model="form.supportsShowcaseOrder" type="checkbox" class="rounded border-gray-300" :disabled="!canEditCritical || !allowedModesSet.has('showcase-order')">
        Витрина + к столу
      </label>
      <div v-if="form.supportsShowcaseOrder" class="md:col-span-2 rounded border border-gray-200 bg-gray-50 p-3">
        <p class="text-sm font-medium text-gray-700">Режим "Витрина + к столу"</p>
        <p class="mt-1 text-xs text-gray-500">Радиокнопки становятся disabled, если режим не разрешен на уровне организации или у пользователя нет прав Owner.</p>
        <div class="mt-2 grid gap-2 md:grid-cols-2">
          <label class="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
            <input
              v-model="showcaseOrderFulfillment"
              type="radio"
              value="to-table"
              :disabled="!canEditCritical || !allowedModesSet.has('showcase-order') || !form.supportsShowcaseOrder"
            >
            До столика
          </label>
          <label class="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
            <input
              v-model="showcaseOrderFulfillment"
              type="radio"
              value="pickup-point"
              :disabled="!canEditCritical || !allowedModesSet.has('showcase-order') || !form.supportsShowcaseOrder"
            >
            На выдачу
          </label>
        </div>
      </div>
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
  <section v-else>
    <h1 class="text-2xl font-semibold">Филиал не найден</h1>
    <p class="mt-2 text-sm text-gray-600">Проверьте ссылку или вернитесь к списку филиалов.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDashboardAccess } from '../../../../composables/useDashboardAccess'

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
  supportsDelivery: boolean
  supportsPickup: boolean
  supportsDineIn: boolean
  supportsQrMenu: boolean
  supportsShowcaseOrder: boolean
  useOrganizationWorkingHours: boolean
  workingHours: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { isOpen: boolean; openAt: string; closeAt: string }>
  isActive: boolean
}

const branch = ref<Branch | null>(null)
const form = ref({
  name: '',
  address: '',
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
const allowedModes = ref<Array<'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'>>(['delivery', 'pickup'])
const allowedModesSet = computed(() => new Set(allowedModes.value))
const showcaseOrderFulfillment = ref<'to-table' | 'pickup-point'>('to-table')
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

onMounted(async () => {
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
  if (!restaurantsRes.ok) return
  const payload = await restaurantsRes.json() as { items?: Branch[] }
  const found = (payload.items || []).find((item) => item.id === String(route.params.id)) || null
  branch.value = found
  if (orgRes.ok) {
    const orgPayload = await orgRes.json() as {
      settings?: {
        ops?: {
          fulfillmentTypes?: Array<'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'>
          showcaseOrderFulfillment?: 'to-table' | 'pickup-point'
        }
      }
    }
    const modes = orgPayload.settings?.ops?.fulfillmentTypes
    if (Array.isArray(modes) && modes.length) allowedModes.value = modes
    const orgShowcaseOrderFulfillment = orgPayload.settings?.ops?.showcaseOrderFulfillment
    if (orgShowcaseOrderFulfillment === 'pickup-point' || orgShowcaseOrderFulfillment === 'to-table') {
      showcaseOrderFulfillment.value = orgShowcaseOrderFulfillment
    }
  }
  if (found) {
    form.value = {
      name: found.name,
      address: found.address,
      supportsDelivery: found.supportsDelivery && allowedModesSet.value.has('delivery'),
      supportsPickup: found.supportsPickup && allowedModesSet.value.has('pickup'),
      supportsDineIn: found.supportsDineIn && allowedModesSet.value.has('dine-in'),
      supportsQrMenu: found.supportsQrMenu && allowedModesSet.value.has('qr-menu'),
      supportsShowcaseOrder: found.supportsShowcaseOrder && allowedModesSet.value.has('showcase-order'),
      useOrganizationWorkingHours: found.useOrganizationWorkingHours !== false,
      workingHours: found.workingHours,
    }
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
      supportsDelivery: allowedModesSet.value.has('delivery') && form.value.supportsDelivery,
      supportsPickup: allowedModesSet.value.has('pickup') && form.value.supportsPickup,
      supportsDineIn: allowedModesSet.value.has('dine-in') && form.value.supportsDineIn,
      supportsQrMenu: allowedModesSet.value.has('qr-menu') && form.value.supportsQrMenu,
      supportsShowcaseOrder: allowedModesSet.value.has('showcase-order') && form.value.supportsShowcaseOrder,
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
</script>
