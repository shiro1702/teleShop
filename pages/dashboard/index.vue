<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Дашборд</h1>
    <p class="text-sm text-gray-600">Быстрые действия для запуска работы.</p>
    <div class="flex flex-wrap gap-3">
      <NuxtLink to="/dashboard/orders" class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300">
        Перейти к заказам
      </NuxtLink>
      <NuxtLink to="/dashboard/settings/organization" class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300">
        Настройки организации
      </NuxtLink>
      <NuxtLink to="/dashboard/branches" class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:border-gray-300">
        Открыть филиалы
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
