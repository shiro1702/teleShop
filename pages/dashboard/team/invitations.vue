<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Приглашения менеджеров</h1>
    <p class="text-sm text-gray-600">Создание invite-ссылок, контроль статусов и ограничение resend.</p>

    <div v-if="role !== 'owner'" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      Только Owner может управлять приглашениями.
    </div>

    <form class="rounded-xl border border-gray-200 bg-white p-4" @submit.prevent="createInvite">
      <h2 class="text-sm font-semibold">Пригласить менеджера</h2>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <input v-model="email" type="email" required placeholder="email@example.com" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <select v-model="selectedRole" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="manager">Manager</option>
          <option value="operator">Оператор заказов</option>
        </select>
      </div>
      <p v-if="errorMessage" class="mt-2 text-sm text-red-700">{{ errorMessage }}</p>
      <button class="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" :disabled="role !== 'owner'">
        Отправить приглашение
      </button>
    </form>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">Список приглашений</h2>
        <select v-model="statusFilter" class="rounded border border-gray-300 px-2 py-1 text-xs">
          <option value="all">Все</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>
      <ul class="space-y-2 text-sm">
        <li v-for="invite in filteredInvites" :key="invite.id" class="rounded border border-gray-100 px-3 py-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium text-gray-900">{{ invite.email }}</p>
              <p class="text-xs text-gray-500">Роль: {{ invite.role }} · Истекает: {{ invite.expiresAt }}</p>
            </div>
            <span class="rounded-full px-2 py-0.5 text-xs" :class="statusClass(invite.status)">{{ invite.status }}</span>
          </div>
          <div class="mt-2 flex gap-2">
            <button
              class="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
              :disabled="!canResend(invite) || role !== 'owner'"
              @click="resend(invite.id)"
            >
              Resend
            </button>
            <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50" :disabled="role !== 'owner'" @click="revoke(invite.id)">
              Revoke
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const { role } = useDashboardAccess()
const email = ref('')
const selectedRole = ref<'manager' | 'operator'>('manager')
const errorMessage = ref<string | null>(null)
const statusFilter = ref<'all' | 'pending' | 'accepted' | 'expired' | 'revoked'>('all')

type Invite = {
  id: string
  email: string
  role: 'manager' | 'operator'
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string
  resentAt: number | null
}

const invites = ref<Invite[]>([
  { id: 'inv-1', email: 'manager@teleshop.app', role: 'manager', status: 'pending', expiresAt: '2026-03-27', resentAt: null },
  { id: 'inv-2', email: 'operator@teleshop.app', role: 'operator', status: 'accepted', expiresAt: '2026-03-24', resentAt: null },
])

const filteredInvites = computed(() =>
  invites.value.filter((item) => statusFilter.value === 'all' || item.status === statusFilter.value))

function createInvite() {
  errorMessage.value = null
  if (role.value !== 'owner') {
    errorMessage.value = 'Недостаточно прав'
    return
  }
  const value = email.value.trim().toLowerCase()
  if (!value) return
  const exists = invites.value.find((item) => item.email === value && item.status === 'pending')
  if (exists) {
    errorMessage.value = 'Для этого email уже есть активный инвайт.'
    return
  }
  invites.value.unshift({
    id: `inv-${Date.now()}`,
    email: value,
    role: selectedRole.value,
    status: 'pending',
    expiresAt: '2026-03-31',
    resentAt: null,
  })
  email.value = ''
}

function canResend(invite: Invite) {
  if (invite.status !== 'pending') return false
  if (!invite.resentAt) return true
  return Date.now() - invite.resentAt > 60_000
}

function resend(id: string) {
  const invite = invites.value.find((item) => item.id === id)
  if (!invite || !canResend(invite)) return
  invite.resentAt = Date.now()
}

function revoke(id: string) {
  const invite = invites.value.find((item) => item.id === id)
  if (!invite) return
  invite.status = 'revoked'
}

function statusClass(status: Invite['status']) {
  if (status === 'accepted') return 'bg-green-100 text-green-700'
  if (status === 'revoked') return 'bg-red-100 text-red-700'
  if (status === 'expired') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}
</script>
