<template>
  <div>
    <NuxtPage />
    <CartModal v-if="!isTelegram" />
  </div>
</template>

<script setup lang="ts">
const { isTelegram } = useTelegram()
</script>
