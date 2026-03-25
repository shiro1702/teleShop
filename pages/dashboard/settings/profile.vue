<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Профиль в дашборде</h1>
    <p class="text-sm text-gray-600">Безопасность аккаунта и управление сессиями.</p>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Смена пароля</h2>
      <div class="mt-2 grid gap-2 md:grid-cols-2">
        <input v-model="currentPassword" type="password" placeholder="Текущий пароль" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <input v-model="nextPassword" type="password" placeholder="Новый пароль (минимум 8 символов)" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
      </div>
      <p v-if="errorMessage" class="mt-2 text-sm text-red-700">{{ errorMessage }}</p>
      <button class="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="changePassword">
        Обновить пароль
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Активные сессии</h2>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="session in sessions" :key="session.id" class="flex items-center justify-between gap-3 rounded border border-gray-100 px-3 py-2">
          <span>{{ session.device }} · {{ session.city }}</span>
          <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="revokeSession(session.id)">Завершить</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
const currentPassword = ref('')
const nextPassword = ref('')
const errorMessage = ref('')
const sessions = ref([
  { id: 'sess-1', device: 'Chrome macOS', city: 'Улан-Удэ' },
  { id: 'sess-2', device: 'Safari iOS', city: 'Иркутск' },
])

function changePassword() {
  errorMessage.value = ''
  if (nextPassword.value.length < 8) {
    errorMessage.value = 'Новый пароль должен содержать минимум 8 символов.'
    return
  }
  if (!window.confirm('Подтвердить смену пароля?')) return
  currentPassword.value = ''
  nextPassword.value = ''
}

function revokeSession(id: string) {
  sessions.value = sessions.value.filter((item) => item.id !== id)
}
</script>
