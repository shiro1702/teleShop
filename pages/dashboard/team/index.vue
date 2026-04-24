<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Команда и доступы</h1>
    <p class="text-sm text-gray-600">
      Здесь управляются роли Owner/Manager, приглашения сотрудников и права доступа к разделам дашборда.
    </p>

    <p v-if="role !== 'owner'" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      У вас роль менеджера. Управление составом команды и правами доступно только Owner.
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink to="/dashboard/team/roles" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
        <p class="text-sm font-medium text-gray-900">Роли и permissions</p>
        <p class="mt-1 text-xs text-gray-600">Матрица доступов Owner/Manager и правила изменения прав.</p>
      </NuxtLink>

      <NuxtLink to="/dashboard/team/invitations" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
        <p class="text-sm font-medium text-gray-900">Приглашения</p>
        <p class="mt-1 text-xs text-gray-600">Инвайт-ссылки, статусы токенов и повторная отправка.</p>
      </NuxtLink>

      <NuxtLink to="/dashboard/team/new-manager" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 sm:col-span-2">
        <p class="text-sm font-medium text-gray-900">Добавить менеджера</p>
        <p class="mt-1 text-xs text-gray-600">Поток добавления нового менеджера и назначение базовых прав.</p>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const { role } = useDashboardAccess()
</script>
