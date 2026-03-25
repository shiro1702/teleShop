<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Меню бренда</h1>
      <p class="mt-2 text-sm text-gray-600">Управление категориями, позициями и публикацией меню (MVP-заглушка).</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink to="/dashboard/menu/categories" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
        <p class="text-sm font-medium text-gray-900">Категории</p>
        <p class="mt-1 text-xs text-gray-600">Создание, сортировка, скрытие/показ категорий.</p>
      </NuxtLink>
      <NuxtLink to="/dashboard/menu/items" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300">
        <p class="text-sm font-medium text-gray-900">Позиции меню</p>
        <p class="mt-1 text-xs text-gray-600">Управление товарами, ценами, доступностью и модификаторами.</p>
      </NuxtLink>
      <NuxtLink to="/dashboard/menu/modifiers" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 sm:col-span-2">
        <p class="text-sm font-medium text-gray-900">Модификаторы</p>
        <p class="mt-1 text-xs text-gray-600">Группы опций: размер, соус, добавки, ограничения выбора и доплаты.</p>
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-dashed border-gray-300 bg-white p-4">
      <h2 class="text-sm font-semibold text-gray-900">Раздел в разработке</h2>
      <p class="mt-1 text-sm text-gray-600">
        Базовые экраны уже доступны, полноценный CRUD и публикация меню будут добавлены на следующем этапе.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
