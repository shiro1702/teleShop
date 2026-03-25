<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Добавить менеджера</h1>
    <p class="text-sm text-gray-600">MVP-мастер: данные, права и подтверждение отправки инвайта.</p>

    <div v-if="role !== 'owner'" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      Экран доступен только Owner.
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <div class="mb-3 text-xs text-gray-500">Шаг {{ step }} из 3 · TTL invite: 72 часа</div>
      <div v-if="step === 1" class="space-y-3">
        <input v-model="draft.email" type="email" placeholder="Email менеджера" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <input v-model="draft.name" type="text" placeholder="Имя (опционально)" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
      </div>
      <div v-else-if="step === 2" class="space-y-2 text-sm">
        <label class="flex items-center gap-2"><input v-model="draft.template" type="radio" value="orders"> Оператор заказов</label>
        <label class="flex items-center gap-2"><input v-model="draft.template" type="radio" value="branch"> Менеджер филиала</label>
        <label class="flex items-center gap-2"><input v-model="draft.template" type="radio" value="custom"> Кастомные права</label>
      </div>
      <div v-else class="text-sm">
        <p>Email: <b>{{ draft.email || '—' }}</b></p>
        <p>Шаблон прав: <b>{{ draft.template }}</b></p>
      </div>
      <p v-if="message" class="mt-2 text-sm" :class="messageType === 'error' ? 'text-red-700' : 'text-green-700'">
        {{ message }}
      </p>
      <div class="mt-3 flex gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="step <= 1 || role !== 'owner'" @click="step--">Назад</button>
        <button
          v-if="step < 3"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          :disabled="role !== 'owner'"
          @click="nextStep"
        >
          Далее
        </button>
        <button
          v-else
          class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          :disabled="role !== 'owner'"
          @click="sendInvite"
        >
          Отправить приглашение
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const { role } = useDashboardAccess()
const step = ref(1)
const draft = ref({
  email: '',
  name: '',
  template: 'orders',
})
const message = ref('')
const messageType = ref<'ok' | 'error'>('ok')

watch(draft, (value) => {
  if (!import.meta.client) return
  localStorage.setItem('dashboard-new-manager-draft', JSON.stringify(value))
}, { deep: true })

onMounted(() => {
  const raw = localStorage.getItem('dashboard-new-manager-draft')
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as typeof draft.value
    draft.value = parsed
  } catch {
    // ignore invalid draft
  }
})

function nextStep() {
  message.value = ''
  if (step.value === 1 && !draft.value.email.trim()) {
    messageType.value = 'error'
    message.value = 'Укажите email менеджера.'
    return
  }
  step.value += 1
}

function sendInvite() {
  if (!draft.value.email.trim()) {
    messageType.value = 'error'
    message.value = 'Укажите email менеджера.'
    return
  }
  messageType.value = 'ok'
  message.value = 'Инвайт отправлен.'
  localStorage.removeItem('dashboard-new-manager-draft')
  step.value = 1
  draft.value = { email: '', name: '', template: 'orders' }
}
</script>
