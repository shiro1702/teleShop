<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Заявки</h1>
    <p class="text-sm text-gray-600">Легковесный MVP workflow: фильтр, ответственный, статус, заметки.</p>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <div class="mb-3 grid gap-2 md:grid-cols-3">
        <select v-model="typeFilter" class="rounded-lg border border-gray-300 px-2 py-2 text-sm">
          <option value="all">Все типы</option>
          <option value="support">Support</option>
          <option value="sales">Sales</option>
        </select>
        <select v-model="statusFilter" class="rounded-lg border border-gray-300 px-2 py-2 text-sm">
          <option value="all">Все статусы</option>
          <option value="new">New</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <ul class="space-y-2">
        <li v-for="item in filteredApplications" :key="item.id" class="rounded border border-gray-100 px-3 py-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium text-gray-900">{{ item.subject }}</p>
              <p class="text-xs text-gray-500">{{ item.type }} · SLA до {{ item.slaUntil }}</p>
            </div>
            <select v-model="item.status" class="rounded border border-gray-300 px-2 py-1 text-xs">
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div class="mt-2 grid gap-2 md:grid-cols-2">
            <input v-model="item.assignee" placeholder="Ответственный" class="rounded border border-gray-300 px-2 py-1 text-xs">
            <input v-model="item.note" placeholder="Заметка" class="rounded border border-gray-300 px-2 py-1 text-xs">
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
const typeFilter = ref<'all' | 'support' | 'sales'>('all')
const statusFilter = ref<'all' | 'new' | 'in_progress' | 'done'>('all')

const applications = ref([
  { id: 'app-1', type: 'support', status: 'new', assignee: '—', note: '', subject: 'Проблема с оплатой', slaUntil: '2026-03-25 10:00' },
  { id: 'app-2', type: 'sales', status: 'in_progress', assignee: 'Алина', note: 'Созвон в 14:00', subject: 'Подключение нового филиала', slaUntil: '2026-03-25 17:00' },
])

const filteredApplications = computed(() => applications.value.filter((item) => {
  if (typeFilter.value !== 'all' && item.type !== typeFilter.value) return false
  if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
  return true
}))
</script>
