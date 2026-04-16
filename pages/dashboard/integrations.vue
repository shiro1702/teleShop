<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-semibold">Интеграции</h1>
    <p class="text-sm text-gray-600">Статусы подключений, health-check и управление секретами.</p>
    <div class="fixed right-4 top-4 z-[100] space-y-2">
      <div v-for="toast in toasts" :key="toast.id" class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg" :class="toast.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'">
        <p class="max-w-xs">{{ toast.message }}</p>
        <button class="ml-1 text-xs" @click="dismissToast(toast.id)">x</button>
      </div>
    </div>

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

      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">Омниканальные уведомления (Telegram + MAX)</h2>
        <div class="mt-3 grid gap-2 md:grid-cols-3">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Primary канал</span>
            <select v-model="channelPolicy.primary" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
              <option value="telegram">Telegram</option>
              <option value="max">MAX</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Secondary канал</span>
            <select v-model="channelPolicy.secondary" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
              <option value="max">MAX</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label class="flex items-center gap-2 pt-7 text-sm">
            <input v-model="channelPolicy.maxEnabled" type="checkbox" :disabled="role !== 'owner'">
            Включить MAX для магазина
          </label>
        </div>

        <div class="mt-4 grid gap-2 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Ресторан</span>
            <select v-model="notificationRestaurantId" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
              <option value="">Выберите ресторан</option>
              <option v-for="r in notificationRestaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Режим менеджерских получателей</span>
            <select v-model="notificationMode" class="w-full rounded-lg border border-gray-300 px-3 py-2" :disabled="role !== 'owner'">
              <option value="group">Группа менеджеров</option>
              <option value="personal">Персональные менеджеры</option>
            </select>
          </label>
        </div>

        <div class="mt-3 grid gap-2 md:grid-cols-2">
          <input v-model="managerGroupChatId" type="text" placeholder="Telegram group chat id" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <input v-model="managerMaxChatId" type="text" placeholder="MAX group chat id" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            :disabled="role !== 'owner' || !notificationRestaurantId"
            @click="createTelegramChatBindLink"
          >
            Привязать через бота
          </button>
          <button
            class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            :disabled="!notificationRestaurantId"
            @click="refreshNotificationRestaurantStatus"
          >
            Проверить статус
          </button>
          <button
            class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            :disabled="role !== 'owner' || !notificationRestaurantId || !managerGroupChatId"
            @click="unlinkTelegramChat"
          >
            Отвязать чат
          </button>
        </div>
        <div v-if="telegramChatBindDeepLink" class="mt-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p class="font-medium">Ссылка для привязки активна до {{ telegramChatBindExpiresAt }}</p>
          <p class="mt-1 break-all">1) Откройте: <a :href="telegramChatBindDeepLink" target="_blank" rel="noopener" class="underline">{{ telegramChatBindDeepLink }}</a></p>
          <p class="mt-1">2) Добавьте бота в нужную группу менеджеров</p>
          <p class="mt-1">3) В группе отправьте: <span class="font-mono">{{ telegramChatBindCommand }}</span></p>
        </div>
        <textarea v-model="managerRecipientsRaw" class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" rows="3" placeholder='[{"channel":"telegram","targetId":"123456"},{"channel":"max","targetId":"conv_1"}]' />

        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || !notificationRestaurantId" @click="saveNotificationSettings">
            Сохранить настройки
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || !notificationRestaurantId" @click="sendTestNotification">
            Проверить уведомление
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="loadNotificationEvents">
            Обновить event-log
          </button>
        </div>
        <p v-if="notificationMessage" class="mt-2 text-sm" :class="notificationMessageType === 'ok' ? 'text-green-700' : 'text-red-700'">
          {{ notificationMessage }}
        </p>
        <ul class="mt-2 space-y-1 text-xs text-gray-600">
          <li v-for="item in notificationEvents" :key="item.id" class="rounded border border-gray-100 px-2 py-1">
            {{ item.created_at }} • {{ item.channel }} • {{ item.delivery_status }} • {{ item.event_type }} • attempts: {{ item.attempt_count }}
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

      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">Quick Resto</h2>
        <p class="mt-1 text-xs text-gray-500">Подключение, синхронизация меню/стоп-листов и ретраи заказов.</p>
        <div class="mt-3 grid gap-2 md:grid-cols-4">
          <select v-model="quickRestoMode" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="mock">mock</option>
            <option value="http">http</option>
          </select>
          <input v-model="quickRestoBaseUrl" type="text" placeholder="https://api.quickresto.ru" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <input v-model="quickRestoApiKey" type="text" placeholder="API key" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <label class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input v-model="quickRestoStrictMode" type="checkbox">
            strict mode
          </label>
        </div>
        <div class="mt-3 grid gap-2 md:grid-cols-3">
          <select v-model="quickRestoMappingRestaurantId" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Филиал для маппинга</option>
            <option v-for="restaurant in restaurants" :key="restaurant.id" :value="restaurant.id">{{ restaurant.name }}</option>
          </select>
          <input v-model="quickRestoMappingPlaceId" type="text" placeholder="quickresto_place_id" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <button class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="saveQuickRestoConnection">Сохранить подключение</button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoHealth">Проверить подключение</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoMenuSync(false)">Синхронизировать меню</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoMenuSync(true)">Dry-run sync</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoStopListSync">Синхронизировать стоп-листы</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoRetryOrders">Переотправить проблемные заказы</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoPromoSync">Синхронизировать промокоды</button>
          <button class="rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runQuickRestoSmokeSeed">Smoke-seed mock demo</button>
        </div>
        <p class="mt-2 text-xs text-gray-600">Mode: {{ quickRestoInfo.mode }} | Health: {{ quickRestoInfo.healthMessage }}</p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-gray-200 p-3">
            <p class="text-xs font-semibold text-gray-700">Последние sync jobs</p>
            <div class="mt-2 max-h-52 overflow-auto">
              <table class="w-full text-left text-xs">
                <thead class="text-gray-500">
                  <tr>
                    <th class="pr-2">Тип</th>
                    <th class="pr-2">Статус</th>
                    <th class="pr-2">Режим</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="job in quickRestoJobs" :key="job.id" class="border-t border-gray-100">
                    <td class="py-1 pr-2">{{ job.job_type }}</td>
                    <td class="py-1 pr-2">{{ job.status }}</td>
                    <td class="py-1 pr-2">{{ job.mode }}</td>
                    <td class="py-1">{{ formatTs(job.created_at) }}</td>
                  </tr>
                  <tr v-if="!quickRestoJobs.length">
                    <td colspan="4" class="py-2 text-gray-400">Нет записей</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="rounded-lg border border-gray-200 p-3">
            <p class="text-xs font-semibold text-gray-700">Последние webhook events</p>
            <div class="mt-2 max-h-52 overflow-auto">
              <table class="w-full text-left text-xs">
                <thead class="text-gray-500">
                  <tr>
                    <th class="pr-2">Событие</th>
                    <th class="pr-2">External ID</th>
                    <th class="pr-2">Статус</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="eventItem in quickRestoEvents" :key="eventItem.id" class="border-t border-gray-100">
                    <td class="py-1 pr-2">{{ eventItem.event_type }}</td>
                    <td class="py-1 pr-2">{{ eventItem.external_event_id }}</td>
                    <td class="py-1 pr-2">{{ eventItem.error ? 'error' : eventItem.processed_at ? 'processed' : 'new' }}</td>
                    <td class="py-1">{{ formatTs(eventItem.created_at) }}</td>
                  </tr>
                  <tr v-if="!quickRestoEvents.length">
                    <td colspan="4" class="py-2 text-gray-400">Нет записей</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
const channelPolicy = ref<{ primary: 'telegram' | 'max'; secondary: 'telegram' | 'max'; maxEnabled: boolean }>({
  primary: 'telegram',
  secondary: 'max',
  maxEnabled: false,
})
const notificationRestaurants = ref<Array<{ id: string; name: string; managerNotificationMode: 'group' | 'personal'; managerGroupChatId: string; managerMaxChatId: string; managerRecipients: Array<{ channel: 'telegram' | 'max'; targetId: string }> }>>([])
const notificationRestaurantId = ref('')
const notificationMode = ref<'group' | 'personal'>('group')
const managerGroupChatId = ref('')
const managerMaxChatId = ref('')
const managerRecipientsRaw = ref('[]')
const notificationMessage = ref('')
const notificationMessageType = ref<'ok' | 'error'>('ok')
const notificationEvents = ref<Array<{ id: string; created_at: string; channel: string; delivery_status: string; event_type: string; attempt_count: number }>>([])
const telegramChatBindDeepLink = ref('')
const telegramChatBindCommand = ref('')
const telegramChatBindExpiresAt = ref('')

const apiKey = ref('live_12ab34cd56ef78gh')
const toasts = ref<Array<{ id: string; type: 'ok' | 'error'; message: string }>>([])
const quickRestoMode = ref<'mock' | 'http'>('mock')
const quickRestoBaseUrl = ref('')
const quickRestoApiKey = ref('')
const quickRestoStrictMode = ref(false)
const quickRestoMappingRestaurantId = ref('')
const quickRestoMappingPlaceId = ref('')
const quickRestoInfo = ref<{ mode: string; healthMessage: string }>({ mode: 'mock', healthMessage: '—' })
const quickRestoJobs = ref<Array<{ id: string; job_type: string; status: string; mode: string; created_at: string }>>([])
const quickRestoEvents = ref<Array<{ id: string; event_type: string; external_event_id: string; error: string | null; processed_at: string | null; created_at: string }>>([])

const maskedApiKey = computed(() => `••••••••${apiKey.value.slice(-4)}`)
const maskedTelegramToken = computed(() => `••••••••${telegramToken.value.slice(-4)}`)

function rotateKey() {
  if (role.value !== 'owner') return
  apiKey.value = `live_${Math.random().toString(36).slice(2, 16)}`
}

function pushToast(type: 'ok' | 'error', message: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toasts.value.push({ id, type, message })
  setTimeout(() => dismissToast(id), type === 'error' ? 12000 : 5000)
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((t: { id: string }) => t.id !== id)
}

function formatTs(raw: string | null | undefined) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('ru-RU')
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
  const restaurant = restaurants.value.find((item: Restaurant) => item.id === selectedRestaurantId.value)
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
  connectedBots.value = connectedBots.value.filter((item: { id: string }) => item.id !== id)
}

function syncSelectedNotificationRestaurant() {
  const selected = notificationRestaurants.value.find((item: { id: string }) => item.id === notificationRestaurantId.value)
  if (!selected) return
  notificationMode.value = selected.managerNotificationMode
  managerGroupChatId.value = selected.managerGroupChatId || ''
  managerMaxChatId.value = selected.managerMaxChatId || ''
  managerRecipientsRaw.value = JSON.stringify(selected.managerRecipients ?? [], null, 2)
}

async function loadNotificationSettings() {
  const response = await fetch('/api/dashboard/integrations/notifications')
  if (!response.ok) return
  const payload = await response.json()
  channelPolicy.value = payload.channelPolicy ?? channelPolicy.value
  notificationRestaurants.value = Array.isArray(payload.restaurants) ? payload.restaurants : []
}

async function loadQuickRestoState() {
  const response = await fetch('/api/dashboard/integrations/quickresto')
  if (!response.ok) return
  const payload = await response.json()
  const cfg = payload?.config ?? {}
  quickRestoMode.value = cfg.mode === 'http' ? 'http' : 'mock'
  quickRestoBaseUrl.value = typeof cfg.baseUrl === 'string' ? cfg.baseUrl : ''
  quickRestoStrictMode.value = cfg.strictMode === true
  quickRestoInfo.value = {
    mode: quickRestoMode.value,
    healthMessage: cfg.hasApiKey ? 'api key configured' : 'api key is empty',
  }
  quickRestoJobs.value = Array.isArray(payload?.jobs) ? payload.jobs : []
  quickRestoEvents.value = Array.isArray(payload?.events) ? payload.events : []
}

async function saveQuickRestoConnection() {
  const restaurantMappings = quickRestoMappingRestaurantId.value && quickRestoMappingPlaceId.value
    ? [{ restaurantId: quickRestoMappingRestaurantId.value, quickrestoPlaceId: quickRestoMappingPlaceId.value }]
    : []
  const response = await fetch('/api/dashboard/integrations/quickresto/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: quickRestoMode.value,
      baseUrl: quickRestoBaseUrl.value,
      apiKey: quickRestoApiKey.value,
      strictMode: quickRestoStrictMode.value,
      restaurantMappings,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось сохранить Quick Resto подключение')
    return
  }
  const isHealthy = payload?.health?.ok === true
  quickRestoInfo.value = { mode: payload.mode || quickRestoMode.value, healthMessage: payload?.health?.message || 'saved' }
  if (!isHealthy) {
    pushToast('error', payload?.health?.message || 'Quick Resto подключен, но health-check не пройден')
    return
  }
  pushToast('ok', 'Quick Resto подключение сохранено и health-check пройден')
  await loadQuickRestoState()
}

async function runQuickRestoHealth() {
  const response = await fetch('/api/dashboard/integrations/quickresto/health-check', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Health-check не выполнен')
    return
  }
  quickRestoInfo.value = { mode: payload.mode || quickRestoMode.value, healthMessage: payload.message || 'OK' }
  pushToast(payload.ok ? 'ok' : 'error', payload.message || 'Health-check завершен')
}

async function runQuickRestoMenuSync(dryRun: boolean) {
  const response = await fetch('/api/dashboard/integrations/quickresto/menu-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Menu sync не выполнен')
  pushToast('ok', dryRun ? `Dry-run: ${payload?.diff?.length || 0} изменений` : 'Синхронизация меню завершена')
}

async function runQuickRestoStopListSync() {
  const response = await fetch('/api/dashboard/integrations/quickresto/stoplist-sync', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Stop-list sync не выполнен')
  pushToast('ok', 'Стоп-листы синхронизированы')
}

async function runQuickRestoRetryOrders() {
  const response = await fetch('/api/dashboard/integrations/quickresto/orders/retry-failed', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Retry failed orders не выполнен')
  pushToast('ok', `Отправлено: ${payload.sent || 0}, ошибок: ${payload.failed || 0}`)
}

async function runQuickRestoPromoSync() {
  const response = await fetch('/api/dashboard/integrations/quickresto/promocodes-sync', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Promo sync не выполнен')
  pushToast('ok', `Промокодов синхронизировано: ${payload.synced || 0}`)
  await loadQuickRestoState()
}

async function runQuickRestoSmokeSeed() {
  const response = await fetch('/api/dashboard/integrations/quickresto/smoke-seed', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Smoke-seed не выполнен')
  pushToast('ok', 'Mock smoke-seed успешно создан')
  await loadQuickRestoState()
}

async function saveNotificationSettings() {
  if (!notificationRestaurantId.value) return
  let parsedRecipients: Array<{ channel: 'telegram' | 'max'; targetId: string }> = []
  try {
    const parsed = JSON.parse(managerRecipientsRaw.value)
    if (Array.isArray(parsed)) {
      parsedRecipients = parsed
    }
  } catch {
    notificationMessageType.value = 'error'
    notificationMessage.value = 'manager_recipients должен быть JSON-массивом.'
    return
  }
  const response = await fetch('/api/dashboard/integrations/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelPolicy: channelPolicy.value,
      restaurantSettings: {
        id: notificationRestaurantId.value,
        managerNotificationMode: notificationMode.value,
        managerGroupChatId: managerGroupChatId.value,
        managerMaxChatId: managerMaxChatId.value,
        managerRecipients: parsedRecipients,
      },
    }),
  })
  notificationMessageType.value = response.ok ? 'ok' : 'error'
  notificationMessage.value = response.ok ? 'Настройки уведомлений сохранены.' : 'Не удалось сохранить настройки.'
}

async function createTelegramChatBindLink() {
  if (!notificationRestaurantId.value) return
  const response = await fetch('/api/dashboard/integrations/telegram-chat-link-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId: notificationRestaurantId.value }),
  })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    notificationMessageType.value = 'error'
    notificationMessage.value = payload?.statusMessage || 'Не удалось создать ссылку привязки.'
    return
  }
  telegramChatBindDeepLink.value = typeof payload.deepLink === 'string' ? payload.deepLink : ''
  telegramChatBindCommand.value = typeof payload.bindCommand === 'string' ? payload.bindCommand : ''
  telegramChatBindExpiresAt.value = typeof payload.tokenExpiresAt === 'string'
    ? new Date(payload.tokenExpiresAt).toLocaleString('ru-RU')
    : ''
  notificationMessageType.value = 'ok'
  notificationMessage.value = 'Ссылка привязки создана. Выполните шаги в Telegram.'
}

async function refreshNotificationRestaurantStatus() {
  if (!notificationRestaurantId.value) return
  await loadNotificationSettings()
  syncSelectedNotificationRestaurant()
}

async function unlinkTelegramChat() {
  if (!notificationRestaurantId.value) return
  const response = await fetch('/api/dashboard/integrations/telegram-chat-unlink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId: notificationRestaurantId.value }),
  })
  if (!response.ok) {
    notificationMessageType.value = 'error'
    notificationMessage.value = 'Не удалось отвязать чат.'
    return
  }
  managerGroupChatId.value = ''
  notificationMessageType.value = 'ok'
  notificationMessage.value = 'Telegram-чат отвязан.'
  await refreshNotificationRestaurantStatus()
}

async function sendTestNotification() {
  if (!notificationRestaurantId.value) return
  const response = await fetch('/api/dashboard/integrations/notifications/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId: notificationRestaurantId.value }),
  })
  notificationMessageType.value = response.ok ? 'ok' : 'error'
  notificationMessage.value = response.ok ? 'Тестовое уведомление отправлено.' : 'Не удалось отправить тест.'
  await loadNotificationEvents()
}

async function loadNotificationEvents() {
  const response = await fetch('/api/dashboard/integrations/notification-events')
  if (!response.ok) return
  const payload = await response.json()
  notificationEvents.value = Array.isArray(payload.items) ? payload.items : []
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
  await loadNotificationSettings()
  await loadNotificationEvents()
  await loadQuickRestoState()
})

watch(notificationRestaurantId, () => {
  telegramChatBindDeepLink.value = ''
  telegramChatBindCommand.value = ''
  telegramChatBindExpiresAt.value = ''
  syncSelectedNotificationRestaurant()
})
</script>
