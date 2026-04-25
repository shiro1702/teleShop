<template>
  <section class="space-y-5">
    <header>
      <h1 class="text-2xl font-semibold text-gray-900">Лидерборд фестиваля</h1>
      <p class="mt-1 text-sm text-gray-600">Демо-экран для ТВ/сцены. Данные временно моковые.</p>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <article class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-amber-800">Хит фестиваля</h2>
        <ol class="mt-3 space-y-2">
          <li v-for="(row, idx) in topByItems" :key="row.name" class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
            <span class="font-medium text-gray-900">{{ idx + 1 }}. {{ row.name }}</span>
            <span class="text-amber-800">{{ row.value }} поз.</span>
          </li>
        </ol>
      </article>

      <article class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-indigo-800">Народная любовь</h2>
        <ol class="mt-3 space-y-2">
          <li v-for="(row, idx) in topByRating" :key="row.name" class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
            <span class="font-medium text-gray-900">{{ idx + 1 }}. {{ row.name }}</span>
            <span class="text-indigo-800">{{ row.value }}</span>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const topByItems = [
  { name: 'Smash&Go', value: 3180 },
  { name: 'Plov Point', value: 2640 },
  { name: 'Bao Hub', value: 2415 },
]

const topByRating = [
  { name: 'Bao Hub', value: '4.9 (126)' },
  { name: 'Smash&Go', value: '4.8 (214)' },
  { name: 'Sushi Garage', value: '4.8 (119)' },
]
</script>
