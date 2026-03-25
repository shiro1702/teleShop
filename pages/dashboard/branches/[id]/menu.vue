<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Меню филиала</h1>
    <p class="text-sm text-gray-600">MVP-режим override: приоритет у настроек филиала поверх бренда.</p>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Состояние меню</h2>
      <div class="mt-2 flex items-center gap-3">
        <span class="rounded-full px-2 py-1 text-xs" :class="menuEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'">
          {{ menuEnabled ? 'Включено' : 'Выключено' }}
        </span>
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="menuEnabled = !menuEnabled">
          Переключить
        </button>
      </div>
      <p class="mt-2 text-xs text-gray-500">Последнее обновление: {{ updatedAt }}</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Быстрые override</h2>
      <div class="mt-2 space-y-2">
        <label class="flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm">
          <span>Маргарита 30см · 590 ₽</span>
          <input v-model="availablePizza" type="checkbox" class="rounded border-gray-300">
        </label>
        <label class="flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm">
          <span>Бургер классический · 420 ₽</span>
          <input v-model="availableBurger" type="checkbox" class="rounded border-gray-300">
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const menuEnabled = ref(true)
const availablePizza = ref(true)
const availableBurger = ref(false)
const updatedAt = computed(() => new Date().toLocaleString('ru-RU'))
</script>
