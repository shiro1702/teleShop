<template>
  <section>
    <h1 class="text-2xl font-semibold">Роли и permissions</h1>
    <p class="mt-2 text-sm text-gray-600">
      TODO: матрица ролей и granular permissions для Owner/Manager.
    </p>
  </section>
</template>

<script setup lang="ts">
declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
</script>
