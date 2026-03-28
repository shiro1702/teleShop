<template>
  <section>
    <h1 class="text-2xl font-semibold">Добавить менеджера</h1>
    <p class="mt-2 text-sm text-gray-600">
      TODO: мастер добавления менеджера (данные, права, отправка приглашения).
    </p>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
