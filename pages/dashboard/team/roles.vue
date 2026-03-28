<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Роли и permissions</h1>
    <p class="text-sm text-gray-600">Матрица ролей и чувствительных прав в рамках MVP.</p>

    <div v-if="role !== 'owner'" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Просмотр доступен, изменение ролей и permissions только для Owner.
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2">Permission</th>
            <th class="px-3 py-2">Owner</th>
            <th class="px-3 py-2">Manager</th>
            <th class="px-3 py-2">Operator</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in permissions" :key="item.key">
            <td class="px-3 py-2">{{ item.label }}</td>
            <td class="px-3 py-2">Да</td>
            <td class="px-3 py-2">
              <input v-model="item.manager" type="checkbox" :disabled="role !== 'owner'">
            </td>
            <td class="px-3 py-2">
              <input v-model="item.operator" type="checkbox" :disabled="role !== 'owner'">
            </td>
          </tr>
        </tbody>
      </table>
      <div class="border-t border-gray-100 px-3 py-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="saveChanges">
          Сохранить изменения
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Audit log</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(entry, idx) in auditLog" :key="idx" class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
          <span>{{ entry.action }}</span>
          <span class="text-gray-500">{{ entry.at }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const { role } = useDashboardAccess()

const permissions = ref([
  { key: 'orders.view', label: 'Просмотр заказов', manager: true, operator: true },
  { key: 'orders.status.change', label: 'Смена статуса заказа', manager: true, operator: true },
  { key: 'orders.kanban.move', label: 'Перетаскивание в канбане', manager: false, operator: true },
  { key: 'branches.view', label: 'Просмотр филиалов', manager: true, operator: false },
  { key: 'team.manage', label: 'Управление командой', manager: false, operator: false },
])

const auditLog = ref<Array<{ action: string; at: string }>>([
  { action: 'Owner обновил критичные permissions', at: '2026-03-24 10:05' },
])

function saveChanges() {
  if (role.value !== 'owner') return
  auditLog.value.unshift({
    action: 'Обновлена матрица прав Manager/Operator',
    at: new Date().toLocaleString('ru-RU'),
  })
}
</script>
