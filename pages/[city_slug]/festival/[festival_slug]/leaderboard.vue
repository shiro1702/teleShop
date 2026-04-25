<template>
  <div class="bg-slate-950 text-white">
    <main class="mx-auto max-w-5xl px-4 py-8 pb-12 sm:px-6 sm:py-10">
      <NuxtLink
        :to="`/${citySlug}/festival/${festivalSlug}/`"
        class="inline-flex text-sm font-medium text-amber-200 hover:text-white"
      >
        ← На фестиваль
      </NuxtLink>

      <header class="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">Публичный экран</p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Лидерборд фестиваля</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
          Рейтинг корнеров для гостей, сцены и организаторов. Сейчас это демо-данные: в боевом режиме места считаются
          по реальным заказам и оценкам гостей.
        </p>
      </header>

      <section class="mt-6 grid gap-4 md:grid-cols-2">
        <article class="rounded-3xl border border-amber-300/30 bg-amber-400/15 p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Номинация</p>
              <h2 class="mt-2 text-2xl font-bold">Хит фестиваля</h2>
            </div>
            <span class="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-slate-950">по продажам</span>
          </div>
          <ol class="mt-5 space-y-3">
            <li
              v-for="(row, idx) in topByItems"
              :key="row.name"
              class="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-950"
            >
              <span class="font-semibold">{{ idx + 1 }}. {{ row.name }}</span>
              <span class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900">
                {{ row.value }} поз.
              </span>
            </li>
          </ol>
        </article>

        <article class="rounded-3xl border border-sky-300/30 bg-sky-400/15 p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">Номинация</p>
              <h2 class="mt-2 text-2xl font-bold">Народная любовь</h2>
            </div>
            <span class="rounded-full bg-sky-300 px-3 py-1 text-xs font-bold text-slate-950">по оценкам</span>
          </div>
          <ol class="mt-5 space-y-3">
            <li
              v-for="(row, idx) in topByRating"
              :key="row.name"
              class="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-950"
            >
              <span class="font-semibold">{{ idx + 1 }}. {{ row.name }}</span>
              <span class="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-900">
                {{ row.value }}
              </span>
            </li>
          </ol>
        </article>
      </section>

      <section class="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5 text-sm leading-6 text-slate-200">
        <h2 class="text-lg font-semibold text-white">Как считается рейтинг</h2>
        <p class="mt-2">
          «Хит фестиваля» сортируется по количеству проданных позиций. «Народная любовь» учитывает среднюю оценку
          гостей после получения заказа, когда у корнера накопилось достаточно отзывов.
        </p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const citySlug = String(route.params.city_slug || 'ulan-ude')
const festivalSlug = String(route.params.festival_slug || 'amtatai-2026')

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
