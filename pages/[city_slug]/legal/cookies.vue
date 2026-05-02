<template>
  <main class="mx-auto max-w-4xl px-4 py-8 text-sm leading-6 text-gray-700 sm:px-6">
    <h1 class="text-2xl font-semibold text-gray-900">Файлы cookie и локальное хранилище</h1>
    <p class="mt-4">
      Платформа pocketmenu.ru использует файлы cookie и аналогичные технологии (например, localStorage), чтобы обеспечить
      вход в аккаунт, сохранение корзины, сессию и безопасность сервиса. Часть данных обрабатывается также в соответствии с
      <NuxtLink :to="`${cityBase}/legal/privacy`" class="text-primary underline decoration-dotted hover:text-primary-700">
        Политикой конфиденциальности
      </NuxtLink>
      и
      <NuxtLink :to="`${cityBase}/legal/consent`" class="text-primary underline decoration-dotted hover:text-primary-700">
        Согласием на обработку персональных данных
      </NuxtLink>
      .
    </p>

    <h2 class="mt-6 text-lg font-semibold text-gray-900">Как отключить cookie</h2>
    <p class="mt-2">
      В настройках браузера вы можете удалить или блокировать cookie; это может ограничить работу сайта (например,
      авторизацию или сохранение корзины).
    </p>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const cityBase = computed(() => {
  const cs = route.params.city_slug
  const city = Array.isArray(cs) ? cs[0] : cs
  return typeof city === 'string' && city.trim() ? `/${city.trim()}` : ''
})
</script>
