<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Глобальное меню</h1>
      <p class="mt-2 text-sm text-gray-600">Управление категориями, позициями и модификаторами для всех филиалов.</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink to="/dashboard/menu/categories" class="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary hover:shadow-sm">
        <p class="text-sm font-semibold text-gray-900">Категории</p>
        <p class="mt-1 text-xs text-gray-600">Создание, сортировка, скрытие/показ категорий.</p>
      </NuxtLink>
      
      <NuxtLink to="/dashboard/menu/items" class="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary hover:shadow-sm">
        <p class="text-sm font-semibold text-gray-900">Позиции меню</p>
        <p class="mt-1 text-xs text-gray-600">Управление товарами, ценами, доступностью и фото.</p>
      </NuxtLink>
      
      <NuxtLink to="/dashboard/menu/modifiers" class="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary hover:shadow-sm">
        <p class="text-sm font-semibold text-gray-900">Модификаторы</p>
        <p class="mt-1 text-xs text-gray-600">Группы опций: размер, соус, добавки, ограничения выбора и доплаты.</p>
      </NuxtLink>

      <NuxtLink to="/dashboard/menu/parameters" class="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary hover:shadow-sm">
        <p class="text-sm font-semibold text-gray-900">Параметры</p>
        <p class="mt-1 text-xs text-gray-600">Справочник типов параметров (например, "Размер", "Объём").</p>
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h2 class="text-sm font-semibold text-gray-900">Как работает меню?</h2>
      <ul class="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
        <li>Здесь вы настраиваете <strong>глобальное меню</strong>, которое является базовым для всех филиалов.</li>
        <li>Чтобы скрыть товар в конкретном филиале или изменить его цену, перейдите в <strong>Филиалы &rarr; Меню филиала</strong>.</li>
        <li>Модификаторы и категории настраиваются только глобально.</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
