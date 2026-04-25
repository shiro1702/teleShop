<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="overflow-x-auto">
        <div class="mx-auto flex min-w-max max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:min-w-0 sm:px-6">
          <div class="flex items-center gap-5">
          <NuxtLink to="/dashboard" class="text-sm font-semibold text-gray-900">
            PocketMenu Dashboard
          </NuxtLink>
          <nav class="flex items-center gap-4 whitespace-nowrap text-sm text-gray-600">
            <NuxtLink v-if="can('orders.view')" to="/dashboard/orders" class="hover:text-gray-900">Заказы</NuxtLink>
            <NuxtLink v-if="can('menu.manage')" to="/dashboard/menu" class="hover:text-gray-900">Меню</NuxtLink>
            <NuxtLink v-if="can('menu.manage')" to="/dashboard/stories" class="hover:text-gray-900">Сториз</NuxtLink>
            <NuxtLink v-if="can('marketing.manage')" to="/dashboard/marketing" class="hover:text-gray-900">Маркетинг</NuxtLink>
            <NuxtLink v-if="can('branches.view')" to="/dashboard/branches" class="hover:text-gray-900">Филиалы</NuxtLink>
            <NuxtLink v-if="can('team.manage')" to="/dashboard/team" class="hover:text-gray-900">Команда</NuxtLink>
            <NuxtLink v-if="can('orders.view')" to="/dashboard/festival-leaderboard" class="hover:text-gray-900">Лидерборд</NuxtLink>
            <NuxtLink v-if="can('settings.org.edit')" to="/dashboard/settings/organization" class="hover:text-gray-900">Настройки</NuxtLink>
            <NuxtLink v-if="can('integrations.manage')" to="/dashboard/integrations" class="hover:text-gray-900">Интеграции</NuxtLink>
          </nav>
        </div>
          <NuxtLink :to="storefrontPath" class="whitespace-nowrap text-sm text-gray-600 hover:text-gray-900">
            На витрину
          </NuxtLink>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <p v-if="error" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        Не удалось определить доступы. Разделы могут отображаться частично.
      </p>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDashboardAccess } from '../composables/useDashboardAccess'

const { can, load, error } = useDashboardAccess()
const storefrontPath = ref('/')
onMounted(() => {
  load()
  fetch('/api/dashboard/storefront')
    .then((response) => response.json() as Promise<{ ok: boolean; path: string }>)
    .then((payload) => {
      storefrontPath.value = payload.path || '/'
    })
    .catch(() => {
      storefrontPath.value = '/'
    })
})
</script>
