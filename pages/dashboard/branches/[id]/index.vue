<template>
  <section v-if="branch" class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Карточка филиала</h1>
        <p class="mt-1 text-sm text-gray-600">{{ branch.name }}</p>
      </div>
      <span class="rounded-full px-2.5 py-1 text-xs font-medium" :class="branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'">
        {{ branch.isActive ? 'Active' : 'Inactive' }}
      </span>
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
import { computed, onMounted, ref } from 'vue'
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
})
const logs = ref<Array<{ action: string; at: string }>>([])
const allowedModes = ref<Array<'delivery' | 'pickup' | 'dine-in' | 'qr-menu' | 'showcase-order'>>(['delivery', 'pickup'])
const allowedModesSet = computed(() => new Set(allowedModes.value))
const showcaseOrderFulfillment = ref<'to-table' | 'pickup-point'>('to-table')

onMounted(async () => {
  const [restaurantsRes, orgRes] = await Promise.all([
    fetch('/api/dashboard/restaurants'),
    fetch('/api/dashboard/organization/style'),
  ])
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
