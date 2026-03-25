<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Категории меню</h1>
      <p class="mt-2 text-sm text-gray-600">Заглушка экрана: управление категориями и их порядком.</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <ul class="space-y-2 text-sm">
        <li class="rounded border border-gray-100 px-3 py-2">Пицца</li>
        <li class="rounded border border-gray-100 px-3 py-2">Бургеры</li>
        <li class="rounded border border-gray-100 px-3 py-2">Напитки</li>
      </ul>
      <p class="mt-3 text-xs text-gray-500">MVP: здесь будет создание, редактирование, сортировка и скрытие категорий.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
