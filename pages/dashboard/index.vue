<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold">Дашборд</h1>
      <p class="text-sm text-gray-600">Быстрые действия для запуска работы.</p>
    </div>

    <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Проверяем доступ и данные организации...
    </div>

    <div v-else-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <div v-else class="flex flex-wrap gap-3">
      <NuxtLink
        v-if="can('orders.view')"
        to="/dashboard/orders"
        class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300"
      >
        Перейти к заказам
      </NuxtLink>
      <NuxtLink
        v-if="can('settings.org.edit')"
        to="/dashboard/settings/organization"
        class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300"
      >
        Настройки организации
      </NuxtLink>
      <NuxtLink
        v-if="can('branches.view')"
        to="/dashboard/branches"
        class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300"
      >
        Открыть филиалы
      </NuxtLink>
    </div>

    <div v-if="!pending && !errorMessage && !hasBranches" class="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p class="text-sm font-medium text-blue-900">В организации пока нет филиалов.</p>
      <p class="mt-1 text-sm text-blue-800">Создайте первый филиал, чтобы начать принимать и обрабатывать заказы.</p>
      <NuxtLink
        v-if="can('branches.create')"
        to="/dashboard/branches/new"
        class="mt-3 inline-flex rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-900 hover:bg-blue-100"
      >
        Создать филиал
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <h2 class="text-sm font-semibold text-gray-900">Скоро на этой странице</h2>
      <p class="mt-1 text-sm text-gray-600">
        KPI и графики дашборда находятся в разработке. Пока используйте разделы «Заказы», «Филиалы» и «Настройки».
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const { access, can, load } = useDashboardAccess()
const pending = ref(true)
const errorMessage = ref<string | null>(null)
const branchCount = ref(0)

const hasBranches = computed(() => branchCount.value > 0)

onMounted(async () => {
  pending.value = true
  errorMessage.value = null
  try {
    await load()
    if (!access.value?.shopId) {
      const redirectFromQuery = typeof route.query.redirect === 'string' ? route.query.redirect : ''
      const redirectPath = redirectFromQuery.startsWith('/dashboard') ? redirectFromQuery : '/dashboard'
      await navigateTo({
        path: '/onboarding',
        query: { redirect: redirectPath },
      })
      return
    }

    const response = await fetch('/api/dashboard/restaurants')
    if (!response.ok) throw new Error('Не удалось загрузить филиалы организации')
    const payload = await response.json() as { ok: boolean; items?: unknown[] }
    branchCount.value = Array.isArray(payload.items) ? payload.items.length : 0
  } catch (err: any) {
    errorMessage.value = err?.message || 'Ошибка загрузки дашборда'
  } finally {
    pending.value = false
  }
})
</script>
