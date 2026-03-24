<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-5">
          <NuxtLink to="/dashboard" class="text-sm font-semibold text-gray-900">
            TeleShop Dashboard
          </NuxtLink>
          <nav class="flex items-center gap-4 text-sm text-gray-600">
            <NuxtLink to="/dashboard/orders" class="hover:text-gray-900">Заказы</NuxtLink>
            <NuxtLink to="/dashboard/branches" class="hover:text-gray-900">Филиалы</NuxtLink>
            <NuxtLink to="/dashboard/team" class="hover:text-gray-900">Команда и доступы</NuxtLink>
            <NuxtLink to="/dashboard/branches/new" class="hover:text-gray-900">Новый филиал</NuxtLink>
            <NuxtLink to="/dashboard/settings/organization" class="hover:text-gray-900">Настройки</NuxtLink>
            <span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              Аналитика: в разработке
            </span>
          </nav>
        </div>
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
