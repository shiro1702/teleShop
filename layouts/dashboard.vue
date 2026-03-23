<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <NuxtLink to="/dashboard" class="text-sm font-semibold text-gray-900">
          TeleShop Dashboard
        </NuxtLink>
        <NuxtLink to="/" class="text-sm text-gray-600 hover:text-gray-900">
          На витрину
        </NuxtLink>
      </div>
    </header>
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <slot />
    </main>
  </div>
</template>
