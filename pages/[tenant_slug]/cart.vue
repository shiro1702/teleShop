<template>
  <div class="min-h-[20vh]" />
</template>

<script setup lang="ts">
const route = useRoute()
const { tenantPath } = useTenant()

await navigateTo(
  {
    path: tenantPath('/checkout'),
    query: { ...route.query, step: '1' },
  },
  { replace: true },
)
</script>
