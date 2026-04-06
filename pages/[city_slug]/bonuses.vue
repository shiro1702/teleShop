<template>
  <section class="mx-auto max-w-2xl px-4 py-10">
    <h1 class="text-2xl font-semibold">Сначала выберите ресторан</h1>
    <p class="mt-2 text-sm text-gray-600">
      Баланс бонусов показывается на странице конкретного ресторана.
    </p>
    <NuxtLink
      :to="`/${String(route.params.city_slug || '')}`"
      class="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-white"
    >
      Перейти к ресторанам
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
