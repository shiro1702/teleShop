<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Позиции меню</h1>
      <p class="mt-2 text-sm text-gray-600">Заглушка экрана: управление товарами, ценами и доступностью.</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <ul class="space-y-2 text-sm">
        <li class="rounded border border-gray-100 px-3 py-2">
          Маргарита 30см — 590 ₽
        </li>
        <li class="rounded border border-gray-100 px-3 py-2">
          Бургер классический — 420 ₽
        </li>
      </ul>
      <p class="mt-3 text-xs text-gray-500">MVP: здесь будет создание позиции, смена цены, стоп-лист и модификаторы.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
