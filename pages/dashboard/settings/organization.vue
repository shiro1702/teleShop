<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Настройки организации</h1>
    <p class="text-sm text-gray-600">Критичные настройки доступны только Owner.</p>

    <div v-if="role !== 'owner'" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Режим только чтение: критичные параметры может изменять только Owner.
    </div>

    <div class="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Название организации</span>
        <input v-model="form.name" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-gray-600">Контактный email</span>
        <input v-model="form.email" type="email" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
      </label>
      <div class="md:col-span-2 flex gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="save">
          Сохранить
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Audit log</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(item, idx) in logs" :key="idx" class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
          <span>{{ item.action }}</span>
          <span class="text-gray-500">{{ item.at }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDashboardAccess } from '../../../composables/useDashboardAccess'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
const { role } = useDashboardAccess()
const form = ref({
  name: 'TeleShop Demo',
  email: 'owner@teleshop.app',
})
const logs = ref<Array<{ action: string; at: string }>>([])

function stamp() {
  return new Date().toLocaleString('ru-RU')
}

function save() {
  if (role.value !== 'owner') return
  logs.value.unshift({ action: 'Обновлены настройки организации', at: stamp() })
}
</script>
