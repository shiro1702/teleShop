<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Модификаторы</h1>
      <p class="mt-2 text-sm text-gray-600">Заглушка экрана: группы модификаторов, опции, доплаты и ограничения.</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <ul class="space-y-2 text-sm">
        <li class="rounded border border-gray-100 px-3 py-2">Размер пиццы: 20см / 30см / 40см</li>
        <li class="rounded border border-gray-100 px-3 py-2">Соусы: выбрать один</li>
        <li class="rounded border border-gray-100 px-3 py-2">Добавки: добавить сыр / убрать лук</li>
      </ul>
      <p class="mt-3 text-xs text-gray-500">
        MVP: здесь будет CRUD групп модификаторов и их привязка к товарам/категориям.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
