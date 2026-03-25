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
        <input v-model="form.supportsDelivery" type="checkbox" class="rounded border-gray-300">
        Доставка
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input v-model="form.supportsPickup" type="checkbox" class="rounded border-gray-300">
        Самовывоз
      </label>
      <div class="md:col-span-2">
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
  isActive: boolean
}

const branch = ref<Branch | null>(null)
const form = ref({
  name: '',
  address: '',
  supportsDelivery: false,
  supportsPickup: false,
})
const logs = ref<Array<{ action: string; at: string }>>([])

onMounted(async () => {
  const res = await fetch('/api/dashboard/restaurants')
  if (!res.ok) return
  const payload = await res.json() as { items?: Branch[] }
  const found = (payload.items || []).find((item) => item.id === String(route.params.id)) || null
  branch.value = found
  if (found) {
    form.value = {
      name: found.name,
      address: found.address,
      supportsDelivery: found.supportsDelivery,
      supportsPickup: found.supportsPickup,
    }
  }
})

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function save() {
  if (!branch.value || !canEditCritical.value) return
  branch.value.name = form.value.name.trim()
  branch.value.address = form.value.address.trim()
  branch.value.supportsDelivery = form.value.supportsDelivery
  branch.value.supportsPickup = form.value.supportsPickup
  logs.value.unshift({ action: 'Обновлены данные филиала', at: now() })
}

function deactivate() {
  if (!branch.value || !canEditCritical.value) return
  const confirmed = window.confirm(`Деактивировать филиал "${branch.value.name}"?`)
  if (!confirmed) return
  branch.value.isActive = false
  logs.value.unshift({ action: 'Филиал деактивирован', at: now() })
}
</script>
