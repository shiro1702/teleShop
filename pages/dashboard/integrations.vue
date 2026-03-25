<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Интеграции</h1>
    <p class="text-sm text-gray-600">Статусы подключений, health-check и управление секретами.</p>

    <div v-if="role !== 'owner'" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Критичные действия с интеграциями доступны только Owner.
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">Telegram Bot</h2>
        <p class="mt-1 text-xs text-gray-500">Webhook: {{ telegramWebhook }}</p>
        <div class="mt-3 grid gap-2 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Bot token</span>
            <input
              v-model="telegramTokenInput"
              type="text"
              placeholder="123456:AA..."
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              :disabled="role !== 'owner'"
            >
          </label>
          <div class="text-sm">
            <span class="mb-1 block text-gray-600">Статус подключения</span>
            <span class="inline-flex rounded-full px-2 py-1 text-xs" :class="telegramConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'">
              {{ telegramConnected ? 'Подключено' : 'Не подключено' }}
            </span>
            <p class="mt-2 text-xs" :class="telegramHealthy ? 'text-green-700' : 'text-red-700'">
              {{ telegramHealthy ? 'Health-check: OK' : 'Health-check: FAIL' }}
            </p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || !telegramTokenInput.trim()" @click="connectTelegramBot">
            Подключить
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || !telegramConnected" @click="reconnectTelegramBot">
            Переподключить
          </button>
          <button class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50" :disabled="role !== 'owner' || !telegramConnected" @click="disconnectTelegramBot">
            Отключить
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="telegramHealthy = !telegramHealthy">
            Проверить/переключить статус
          </button>
        </div>
        <p v-if="telegramMessage" class="mt-2 text-sm" :class="telegramMessageType === 'ok' ? 'text-green-700' : 'text-red-700'">
          {{ telegramMessage }}
        </p>
      </article>

      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">Подключенные Telegram-боты к ресторанам</h2>
        <p class="mt-1 text-xs text-gray-500">Привяжите бота к конкретному ресторану для обработки заказов.</p>
        <div class="mt-3 grid gap-2 md:grid-cols-3">
          <select v-model="selectedRestaurantId" class="rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
            <option value="">Выберите ресторан</option>
            <option v-for="restaurant in restaurants" :key="restaurant.id" :value="restaurant.id">
              {{ restaurant.name }}
            </option>
          </select>
          <input
            v-model="botNameInput"
            type="text"
            placeholder="@my_restaurant_bot"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            :disabled="role !== 'owner'"
          >
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="attachBotToRestaurant">
            Привязать бота
          </button>
        </div>
        <ul class="mt-3 space-y-2 text-sm">
          <li v-for="item in connectedBots" :key="item.id" class="flex items-center justify-between gap-3 rounded border border-gray-100 px-3 py-2">
            <div>
              <p class="font-medium text-gray-900">{{ item.botName }}</p>
              <p class="text-xs text-gray-500">{{ item.restaurantName }}</p>
            </div>
            <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="detachBot(item.id)">
              Отвязать
            </button>
          </li>
          <li v-if="!connectedBots.length" class="rounded border border-dashed border-gray-200 px-3 py-2 text-gray-500">
            Пока нет привязанных Telegram-ботов.
          </li>
        </ul>
      </article>

      <article class="rounded-xl border border-gray-200 bg-white p-4">
        <h2 class="text-sm font-semibold">API key (masked)</h2>
        <p class="mt-1 text-xs text-gray-500">{{ maskedApiKey }}</p>
        <button class="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="rotateKey">
          Ротировать ключ
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDashboardAccess } from '../../composables/useDashboardAccess'

declare const definePageMeta: (meta: Record<string, unknown>) => void
definePageMeta({ layout: 'dashboard' })
const { role } = useDashboardAccess()
const telegramWebhook = ref('https://api.teleshop.app/webhook/telegram')
const telegramHealthy = ref(true)
const telegramToken = ref('tg_live_12fd9aabce98')
const telegramTokenInput = ref('')
const telegramConnected = ref(false)
const telegramMessage = ref('')
const telegramMessageType = ref<'ok' | 'error'>('ok')

type Restaurant = { id: string; name: string }
const restaurants = ref<Restaurant[]>([])
const selectedRestaurantId = ref('')
const botNameInput = ref('')
const connectedBots = ref<Array<{ id: string; botName: string; restaurantId: string; restaurantName: string }>>([])

const apiKey = ref('live_12ab34cd56ef78gh')

const maskedApiKey = computed(() => `••••••••${apiKey.value.slice(-4)}`)
const maskedTelegramToken = computed(() => `••••••••${telegramToken.value.slice(-4)}`)

function rotateKey() {
  if (role.value !== 'owner') return
  apiKey.value = `live_${Math.random().toString(36).slice(2, 16)}`
}

function connectTelegramBot() {
  if (role.value !== 'owner') return
  telegramMessage.value = ''
  const value = telegramTokenInput.value.trim()
  if (!value || !value.includes(':')) {
    telegramMessageType.value = 'error'
    telegramMessage.value = 'Введите корректный Telegram token.'
    return
  }
  telegramToken.value = value
  telegramConnected.value = true
  telegramMessageType.value = 'ok'
  telegramMessage.value = 'Telegram bot успешно подключен.'
}

function reconnectTelegramBot() {
  if (role.value !== 'owner' || !telegramConnected.value) return
  telegramHealthy.value = true
  telegramMessageType.value = 'ok'
  telegramMessage.value = 'Telegram bot переподключен.'
}

function disconnectTelegramBot() {
  if (role.value !== 'owner' || !telegramConnected.value) return
  telegramConnected.value = false
  telegramTokenInput.value = ''
  telegramMessageType.value = 'ok'
  telegramMessage.value = 'Telegram bot отключен.'
}

function attachBotToRestaurant() {
  if (role.value !== 'owner') return
  const restaurant = restaurants.value.find((item) => item.id === selectedRestaurantId.value)
  if (!restaurant || !botNameInput.value.trim()) return
  connectedBots.value.push({
    id: `${Date.now()}`,
    botName: botNameInput.value.trim(),
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
  })
  botNameInput.value = ''
  selectedRestaurantId.value = ''
}

function detachBot(id: string) {
  connectedBots.value = connectedBots.value.filter((item) => item.id !== id)
}

onMounted(async () => {
  try {
    const response = await fetch('/api/dashboard/restaurants')
    if (!response.ok) return
    const payload = await response.json() as { items?: Array<{ id: string; name: string }> }
    restaurants.value = Array.isArray(payload.items) ? payload.items : []
  } catch {
    restaurants.value = []
  }
})
</script>
