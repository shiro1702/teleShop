<template>
  <div class="mx-auto max-w-lg px-4 py-10">
    <h1 class="text-2xl font-bold text-gray-900">Создать магазин</h1>
    <p class="mt-2 text-sm text-gray-600">
      Укажите данные магазина и первой точки. После создания вы попадёте в админку.
    </p>

    <form class="mt-8 space-y-5" @submit.prevent="submit">
      <fieldset class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <legend class="px-1 text-sm font-semibold text-gray-800">Магазин</legend>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Название</span>
          <input
            v-model="shopName"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Моя пиццерия"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Адрес в URL (slug)</span>
          <input
            v-model="slug"
            type="text"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm lowercase"
            placeholder="my-pizza"
          />
          <span class="text-xs text-gray-500">Латиница и дефис, например <code class="rounded bg-gray-100 px-1">my-shop</code></span>
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Описание (необязательно)</span>
          <textarea
            v-model="shopDescription"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </fieldset>

      <fieldset class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <legend class="px-1 text-sm font-semibold text-gray-800">Первая точка</legend>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Название точки</span>
          <input
            v-model="restaurantName"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Адрес</span>
          <input
            v-model="address"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div class="flex flex-wrap gap-4 text-sm">
          <label class="inline-flex items-center gap-2">
            <input v-model="supportsDelivery" type="checkbox" class="rounded border-gray-300" />
            Доставка
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="supportsPickup" type="checkbox" class="rounded border-gray-300" />
            Самовывоз
          </label>
        </div>
      </fieldset>

      <fieldset class="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <legend class="px-1 text-sm font-semibold text-gray-800">Свой Telegram-бот (необязательно)</legend>
        <p class="text-xs text-gray-600">
          Если поле пустое, магазин использует <strong>платформенного бота</strong> сервера
          (<code class="rounded bg-gray-100 px-1">NUXT_BOT_TOKEN</code>): регистрация клиентов и уведомления идут через него.
          Подробнее: файл <code class="rounded bg-gray-100 px-1 text-xs">docs/TELEGRAM_PLATFORM_BOT.md</code> в репозитории.
        </p>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Токен своего бота от @BotFather</span>
          <input
            v-model="telegramBotToken"
            type="password"
            autocomplete="off"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            placeholder="Пусто = платформенный бот или NUXT_ONBOARDING_PLACEHOLDER_BOT_TOKEN"
          />
        </label>
      </fieldset>

      <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

      <button
        type="submit"
        class="w-full rounded-lg bg-[#E25E2D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C84E24] disabled:opacity-50"
        :disabled="loading"
      >
        {{ loading ? 'Создание…' : 'Создать' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const shopName = ref('')
const slug = ref('')
const shopDescription = ref('')
const restaurantName = ref('')
const address = ref('')
const supportsDelivery = ref(true)
const supportsPickup = ref(true)
const telegramBotToken = ref('')

const loading = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const accessRes = await fetch('/api/dashboard/access')
    if (!accessRes.ok) return
    const access = await accessRes.json() as { ok: boolean; shopId?: string }
    if (access?.ok && access.shopId) {
      const redir = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
      await router.replace(redir)
    }
  } catch {
    /* allow form */
  }
})

async function submit() {
  errorMsg.value = null
  loading.value = true
  try {
    const resRaw = await fetch('/api/onboarding/create-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: shopName.value,
        slug: slug.value.trim().toLowerCase(),
        shopDescription: shopDescription.value.trim() || undefined,
        restaurantName: restaurantName.value,
        address: address.value,
        supportsDelivery: supportsDelivery.value,
        supportsPickup: supportsPickup.value,
        telegramBotToken: telegramBotToken.value.trim() || undefined,
      }),
    })
    const res = await resRaw.json() as {
      ok: boolean
      shopId: string
      shopSlug: string
    }

    if (!res?.ok || !res.shopId) {
      throw new Error('Некорректный ответ сервера')
    }

    const redir = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redir)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; message?: string }
    errorMsg.value = err?.data?.message ?? err?.message ?? 'Не удалось создать магазин'
  } finally {
    loading.value = false
  }
}
</script>
