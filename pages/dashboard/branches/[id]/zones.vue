<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Зоны доставки филиала</h1>
    <p class="text-sm text-gray-600">MVP-режим: правила зон и проверка пересечений без карты.</p>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Зоны</h2>
      <div class="mt-2 space-y-2 text-sm">
        <label class="block">
          <span class="mb-1 block text-gray-600">Зона A · Радиус (км)</span>
          <input v-model.number="zoneARadius" type="number" min="1" class="w-full rounded-lg border border-gray-300 px-2 py-2">
        </label>
        <label class="block">
          <span class="mb-1 block text-gray-600">Зона B · Радиус (км)</span>
          <input v-model.number="zoneBRadius" type="number" min="1" class="w-full rounded-lg border border-gray-300 px-2 py-2">
        </label>
      </div>
      <p class="mt-2 text-xs" :class="zonesOverlap ? 'text-amber-700' : 'text-green-700'">
        {{ zonesOverlap ? 'Есть потенциальное пересечение зон. Приоритет: зона с меньшей стоимостью доставки.' : 'Пересечений не обнаружено.' }}
      </p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Тарифы</h2>
      <div class="mt-2 grid gap-2 md:grid-cols-3">
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Доставка, ₽</span>
          <input v-model.number="deliveryPrice" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2">
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Бесплатно от, ₽</span>
          <input v-model.number="freeFrom" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2">
        </label>
        <label class="text-sm">
          <span class="mb-1 block text-gray-600">Минималка, ₽</span>
          <input v-model.number="minOrder" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-2 py-2">
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
const zoneARadius = ref(5)
const zoneBRadius = ref(7)
const deliveryPrice = ref(199)
const freeFrom = ref(1800)
const minOrder = ref(700)

const zonesOverlap = computed(() => Math.abs(zoneARadius.value - zoneBRadius.value) <= 2)
</script>
