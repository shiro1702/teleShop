<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <NuxtLink to="/dashboard/integrations" class="text-sm text-primary hover:underline">← Назад к интеграциям</NuxtLink>
        <h1 class="mt-2 text-2xl font-semibold">Уведомления филиала</h1>
        <p class="mt-1 text-sm text-gray-600">{{ restaurantName || 'Загрузка филиала...' }}</p>
      </div>
      <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" @click="loadSettings">Обновить</button>
    </div>

    <div class="fixed right-4 top-4 z-[100] space-y-2">
      <div v-for="toast in toasts" :key="toast.id" class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg" :class="toast.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'">
        <p class="max-w-xs">{{ toast.message }}</p>
        <button class="ml-1 text-xs" @click="dismissToast(toast.id)">x</button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Режим менеджерских получателей</h2>
      <p class="mt-1 text-xs text-gray-500">
        <span class="font-medium">Группа менеджеров</span> отправляет уведомления в общий Telegram/MAX-чат филиала.
        <span class="font-medium">Персональные менеджеры</span> отправляют уведомления по массиву получателей ниже.
      </p>
      <select v-model="notificationMode" class="mt-3 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
        <option value="group">Группа менеджеров</option>
        <option value="personal">Персональные менеджеры</option>
      </select>
    </div>

    <div class="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="rounded-lg px-3 py-2 text-sm transition-colors"
        :class="activeTab === tab.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <article v-if="activeTab === 'telegram'" class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Telegram</h2>
      <p class="mt-1 text-xs text-gray-500">Telegram-группа привязывается через deep-link и команду <span class="font-mono">/bind</span>.</p>
      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-gray-600">Telegram group chat id</span>
        <input v-model="managerGroupChatId" type="text" placeholder="-100..." class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="createTelegramChatBindLink">
          Создать ссылку привязки Telegram
        </button>
        <button class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50" :disabled="role !== 'owner' || !managerGroupChatId" @click="unlinkTelegramChat">
          Отвязать Telegram-чат
        </button>
      </div>
      <div v-if="telegramChatBindDeepLink" class="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p class="font-medium">Ссылка для привязки активна до {{ telegramChatBindExpiresAt }}</p>
        <p class="mt-1 break-all">1) Откройте: <a :href="telegramChatBindDeepLink" target="_blank" rel="noopener" class="underline">{{ telegramChatBindDeepLink }}</a></p>
        <p class="mt-1">2) Добавьте бота в нужную группу менеджеров</p>
        <p class="mt-1">3) В группе отправьте: <span class="font-mono">{{ telegramChatBindCommand }}</span></p>
      </div>
    </article>

    <article v-else-if="activeTab === 'max'" class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">MAX</h2>
      <p class="mt-1 text-xs text-gray-500">MAX-группа привязывается через временную ссылку и slash-команду <span class="font-mono">/bindmax</span> в чате менеджеров.</p>
      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-gray-600">MAX group chat id / conversation id</span>
        <input v-model="managerMaxChatId" type="text" placeholder="conv_..." class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="createMaxChatBindLink">
          Создать ссылку привязки MAX
        </button>
      </div>
      <div v-if="maxChatBindDeepLink" class="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p class="font-medium">Ссылка для привязки активна до {{ maxChatBindExpiresAt }}</p>
        <p class="mt-1 break-all">1) Откройте: <a :href="maxChatBindDeepLink" target="_blank" rel="noopener" class="underline">{{ maxChatBindDeepLink }}</a></p>
        <p class="mt-1">2) Добавьте MAX-бота в нужную группу менеджеров</p>
        <p class="mt-1">3) В группе отправьте именно slash-команду: <span class="font-mono">{{ maxChatBindCommand }}</span></p>
      </div>
      <div class="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
        <p class="font-medium">Ручной fallback</p>
        <p class="mt-1">Если MAX не передал стартовый параметр или команда не дошла до webhook, можно временно вставить conversation id вручную и сохранить настройки.</p>
      </div>
    </article>

    <article v-else class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Персональные получатели</h2>
      <p class="mt-1 text-xs text-gray-500">
        Массив нужен только для режима “Персональные менеджеры”. Каждый элемент: канал и адрес получателя.
      </p>
      <pre class="mt-3 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-600">[
  {"channel":"telegram","targetId":"123456"},
  {"channel":"max","targetId":"conv_1"}
]</pre>
      <textarea v-model="managerRecipientsRaw" class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs" rows="5" placeholder='[{"channel":"telegram","targetId":"123456"},{"channel":"max","targetId":"conv_1"}]' :disabled="role !== 'owner'" />
    </article>

    <article class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Единый flow Telegram + MAX</h2>
      <p class="mt-1 text-xs text-gray-500">
        Единый flow включен всегда. Ниже настраиваются только ETA-кнопки и лимиты.
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="etaButtonsEnabled" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner'">
          <span>Кнопки ETA для клиента</span>
        </label>
      </div>
      <div v-if="etaButtonsEnabled" class="mt-3">
        <p class="mb-2 text-sm text-gray-600">Пресеты ETA (готовые варианты)</p>
        <div class="grid gap-2 sm:grid-cols-3">
          <label v-for="preset in etaPresetOptions" :key="preset" class="inline-flex items-center gap-2 text-sm">
            <input v-model="etaPresetsSelected" :value="preset" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner'">
            <span>{{ preset }} мин</span>
          </label>
        </div>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-gray-600">Ограничение обновлений ETA (сек)</span>
          <input v-model.number="etaRateLimitSec" type="number" min="30" max="3600" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
        </label>
      </div>
    </article>

    <article class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Сервисные вызовы (по филиалу)</h2>
      <p class="mt-1 text-xs text-gray-500">
        Управление кнопками «Позвать официанта / кальянщика / выставить счет» отдельно для каждого филиала.
      </p>
      <p class="mt-1 text-xs text-amber-700">
        Глобальные ограничения из настроек организации применяются автоматически и не могут быть переопределены в филиале.
      </p>
      <label class="mt-3 inline-flex items-center gap-2 text-sm">
        <input v-model="serviceCallsEnabled" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner'">
        <span>Включить сервисные вызовы в этом филиале</span>
      </label>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="serviceCallTypeWaiter" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner' || !serviceCallsEnabled || !orgAllowedWaiter">
          <span>Позвать официанта</span>
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="serviceCallTypeHookah" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner' || !serviceCallsEnabled || !orgAllowedHookah">
          <span>Позвать кальянщика</span>
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="serviceCallTypeBill" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" :disabled="role !== 'owner' || !serviceCallsEnabled || !orgAllowedBill">
          <span>Выставить счет</span>
        </label>
      </div>
    </article>

    <article class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Сервисные вызовы: мониторинг (7 дней)</h2>
      <div class="mt-2 grid gap-2 sm:grid-cols-4">
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">Всего: <span class="font-semibold">{{ serviceCallStats.total }}</span></div>
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">Открытых: <span class="font-semibold">{{ serviceCallStats.open }}</span></div>
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">Средний 1-й ответ: <span class="font-semibold">{{ serviceCallStats.avgFirstResponseSec != null ? `${serviceCallStats.avgFirstResponseSec} сек` : '—' }}</span></div>
        <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">Среднее закрытие: <span class="font-semibold">{{ serviceCallStats.avgResolvedSec != null ? `${serviceCallStats.avgResolvedSec} сек` : '—' }}</span></div>
      </div>
    </article>

    <article class="rounded-xl border border-gray-200 bg-white p-4">
      <h2 class="text-sm font-semibold">Привязка сотрудников ботов</h2>
      <p class="mt-1 text-xs text-gray-500">
        Только привязанные сотрудники могут отправлять быстрые ответы по сервисным вызовам.
      </p>
      <div class="mt-3 grid gap-2 md:grid-cols-5">
        <select v-model="newBindingChannel" class="rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
          <option value="telegram">Telegram</option>
          <option value="max">MAX</option>
        </select>
        <input v-model.trim="newBindingExternalUserId" class="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="External user id" :disabled="role !== 'owner'">
        <select v-model="newBindingStaffRole" class="rounded-lg border border-gray-300 px-3 py-2 text-sm" :disabled="role !== 'owner'">
          <option value="waiter">waiter</option>
          <option value="hookah">hookah</option>
          <option value="cashier">cashier</option>
          <option value="manager">manager</option>
        </select>
        <button class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="saveStaffBinding">
          Добавить/обновить
        </button>
      </div>
      <div v-if="staffBotBindings.length" class="mt-3 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="text-left text-gray-500">
              <th class="px-2 py-1">Канал</th>
              <th class="px-2 py-1">User ID</th>
              <th class="px-2 py-1">Роль</th>
              <th class="px-2 py-1">Имя</th>
              <th class="px-2 py-1">Активен</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in staffBotBindings" :key="item.id" class="border-t border-gray-100">
              <td class="px-2 py-1">{{ item.channel }}</td>
              <td class="px-2 py-1 font-mono">{{ item.externalUserId }}</td>
              <td class="px-2 py-1">{{ item.staffRole }}</td>
              <td class="px-2 py-1">{{ item.displayName || '—' }}</td>
              <td class="px-2 py-1">{{ item.isActive ? 'Да' : 'Нет' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="mt-3 text-xs text-gray-500">Пока нет привязанных сотрудников.</p>
    </article>

    <div class="flex flex-wrap gap-2">
      <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || saving" @click="saveSettings">
        Сохранить настройки
      </button>
      <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner' || saving" @click="sendTestNotification">
        Проверить уведомление
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDashboardAccess } from '../../../../composables/useDashboardAccess'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const { role, load } = useDashboardAccess()
const restaurantId = typeof route.params.restaurantId === 'string' ? route.params.restaurantId : ''
const tabs = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'max', label: 'MAX' },
  { id: 'recipients', label: 'Получатели' },
] as const
const activeTab = ref<(typeof tabs)[number]['id']>('telegram')
const restaurantName = ref('')
const notificationMode = ref<'group' | 'personal'>('group')
const managerGroupChatId = ref('')
const managerMaxChatId = ref('')
const managerRecipientsRaw = ref('[]')
const serviceCallsEnabled = ref(false)
const serviceCallTypeWaiter = ref(true)
const serviceCallTypeHookah = ref(true)
const serviceCallTypeBill = ref(true)
const orgAllowedWaiter = ref(true)
const orgAllowedHookah = ref(false)
const orgAllowedBill = ref(true)
const etaButtonsEnabled = ref(false)
const etaPresetOptions = [10, 15, 20, 30, 45, 60] as const
const etaPresetsSelected = ref<number[]>([10, 15, 20, 30, 45])
const etaRateLimitSec = ref(180)
const staffBotBindings = ref<Array<{ id: string; channel: string; externalUserId: string; staffRole: string; displayName: string; isActive: boolean }>>([])
const serviceCallStats = ref<{ total: number; open: number; avgFirstResponseSec: number | null; avgResolvedSec: number | null }>({
  total: 0,
  open: 0,
  avgFirstResponseSec: null,
  avgResolvedSec: null,
})
const newBindingChannel = ref<'telegram' | 'max'>('telegram')
const newBindingExternalUserId = ref('')
const newBindingStaffRole = ref<'waiter' | 'hookah' | 'cashier' | 'manager'>('waiter')
const saving = ref(false)
const telegramChatBindDeepLink = ref('')
const telegramChatBindCommand = ref('')
const telegramChatBindExpiresAt = ref('')
const maxChatBindDeepLink = ref('')
const maxChatBindCommand = ref('')
const maxChatBindExpiresAt = ref('')
const toasts = ref<Array<{ id: string; type: 'ok' | 'error'; message: string }>>([])

function pushToast(type: 'ok' | 'error', message: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toasts.value.push({ id, type, message })
  setTimeout(() => dismissToast(id), type === 'error' ? 12000 : 5000)
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((t: { id: string }) => t.id !== id)
}

async function loadSettings() {
  const params = new URLSearchParams({ restaurantId, pageSize: '1' })
  const response = await fetch(`/api/dashboard/integrations/notifications?${params.toString()}`)
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok || !Array.isArray(payload.restaurants) || !payload.restaurants[0]) {
    pushToast('error', payload?.statusMessage || 'Не удалось загрузить настройки филиала')
    return
  }
  const item = payload.restaurants[0]
  restaurantName.value = item.name || ''
  notificationMode.value = item.managerNotificationMode === 'personal' ? 'personal' : 'group'
  managerGroupChatId.value = item.managerGroupChatId || ''
  managerMaxChatId.value = item.managerMaxChatId || ''
  managerRecipientsRaw.value = JSON.stringify(item.managerRecipients ?? [], null, 2)
  serviceCallsEnabled.value = item.serviceCallsEnabled === true
  const types = Array.isArray(item.serviceCallTypes) ? item.serviceCallTypes : []
  serviceCallTypeWaiter.value = types.includes('call_waiter')
  serviceCallTypeHookah.value = types.includes('call_hookah')
  serviceCallTypeBill.value = types.includes('request_bill')
  etaButtonsEnabled.value = item.etaButtonsEnabled === true
  etaPresetsSelected.value = Array.isArray(item.etaPresets)
    ? item.etaPresets
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && etaPresetOptions.includes(value as (typeof etaPresetOptions)[number]))
    : [10, 15, 20, 30, 45]
  etaRateLimitSec.value = Number.isFinite(Number(item.etaRateLimitSec)) ? Number(item.etaRateLimitSec) : 180
  await loadOrganizationRestrictions()
  if (!orgAllowedWaiter.value) serviceCallTypeWaiter.value = false
  if (!orgAllowedHookah.value) serviceCallTypeHookah.value = false
  if (!orgAllowedBill.value) serviceCallTypeBill.value = false
  staffBotBindings.value = Array.isArray(item.staffBotBindings) ? item.staffBotBindings : []
  await loadServiceCallStats()
}

async function loadOrganizationRestrictions() {
  const response = await fetch('/api/dashboard/organization/style')
  const payload = await response.json().catch(() => ({} as any))
  const buttons = payload?.settings?.ops?.dineInStaffButtons ?? {}
  orgAllowedWaiter.value = buttons.waiter !== false
  orgAllowedHookah.value = buttons.hookah === true
  orgAllowedBill.value = buttons.requestBill !== false
}

async function loadServiceCallStats() {
  const params = new URLSearchParams({ restaurantId })
  const response = await fetch(`/api/dashboard/service-calls?${params.toString()}`)
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok || !payload?.stats) {
    return
  }
  serviceCallStats.value = {
    total: Number(payload.stats.total || 0),
    open: Number(payload.stats.open || 0),
    avgFirstResponseSec: typeof payload.stats.avgFirstResponseSec === 'number' ? payload.stats.avgFirstResponseSec : null,
    avgResolvedSec: typeof payload.stats.avgResolvedSec === 'number' ? payload.stats.avgResolvedSec : null,
  }
}

async function saveSettings() {
  let parsedRecipients: Array<{ channel: 'telegram' | 'max'; targetId: string }> = []
  try {
    const parsed = JSON.parse(managerRecipientsRaw.value)
    if (Array.isArray(parsed)) parsedRecipients = parsed
  } catch {
    pushToast('error', 'Получатели должны быть JSON-массивом')
    return
  }
  const etaPresets = Array.from(new Set<number>(etaPresetsSelected.value))
    .filter((value: number) => etaPresetOptions.includes(value as (typeof etaPresetOptions)[number]))
    .slice(0, 8)
  if (!etaPresets.length) {
    pushToast('error', 'Укажите хотя бы один корректный preset ETA')
    return
  }
  const normalizedRateLimit = Number(etaRateLimitSec.value)
  if (!Number.isFinite(normalizedRateLimit) || normalizedRateLimit < 30 || normalizedRateLimit > 3600) {
    pushToast('error', 'Ограничение ETA должно быть от 30 до 3600 секунд')
    return
  }
  saving.value = true
  const response = await fetch('/api/dashboard/integrations/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantSettings: {
        id: restaurantId,
        managerNotificationMode: notificationMode.value,
        managerGroupChatId: managerGroupChatId.value,
        managerMaxChatId: managerMaxChatId.value,
        managerRecipients: parsedRecipients,
        serviceCallsEnabled: serviceCallsEnabled.value,
        serviceCallTypes: [
          ...(orgAllowedWaiter.value && serviceCallTypeWaiter.value ? ['call_waiter'] : []),
          ...(orgAllowedHookah.value && serviceCallTypeHookah.value ? ['call_hookah'] : []),
          ...(orgAllowedBill.value && serviceCallTypeBill.value ? ['request_bill'] : []),
        ],
        etaButtonsEnabled: etaButtonsEnabled.value,
        etaPresets,
        etaRateLimitSec: Math.floor(normalizedRateLimit),
      },
    }),
  })
  saving.value = false
  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as any))
    pushToast('error', payload?.statusMessage || 'Не удалось сохранить настройки')
    return
  }
  pushToast('ok', 'Настройки сохранены')
  await loadSettings()
}

async function saveStaffBinding() {
  if (!newBindingExternalUserId.value.trim()) {
    pushToast('error', 'Укажите external user id сотрудника')
    return
  }
  const response = await fetch('/api/dashboard/integrations/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffBindingUpsert: {
        restaurantId,
        channel: newBindingChannel.value,
        externalUserId: newBindingExternalUserId.value.trim(),
        staffRole: newBindingStaffRole.value,
      },
    }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as any))
    pushToast('error', payload?.statusMessage || 'Не удалось сохранить привязку сотрудника')
    return
  }
  pushToast('ok', 'Привязка сотрудника сохранена')
  newBindingExternalUserId.value = ''
  await loadSettings()
}

async function createTelegramChatBindLink() {
  const response = await fetch('/api/dashboard/integrations/telegram-chat-link-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось создать ссылку привязки')
    return
  }
  telegramChatBindDeepLink.value = typeof payload.deepLink === 'string' ? payload.deepLink : ''
  telegramChatBindCommand.value = typeof payload.bindCommand === 'string' ? payload.bindCommand : ''
  telegramChatBindExpiresAt.value = typeof payload.tokenExpiresAt === 'string'
    ? new Date(payload.tokenExpiresAt).toLocaleString('ru-RU')
    : ''
}

async function createMaxChatBindLink() {
  const response = await fetch('/api/dashboard/integrations/max-chat-link-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось создать ссылку привязки MAX')
    return
  }
  maxChatBindDeepLink.value = typeof payload.deepLink === 'string' ? payload.deepLink : ''
  maxChatBindCommand.value = typeof payload.bindCommand === 'string' ? payload.bindCommand : ''
  maxChatBindExpiresAt.value = typeof payload.tokenExpiresAt === 'string'
    ? new Date(payload.tokenExpiresAt).toLocaleString('ru-RU')
    : ''
}

async function unlinkTelegramChat() {
  const response = await fetch('/api/dashboard/integrations/telegram-chat-unlink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  })
  if (!response.ok) {
    pushToast('error', 'Не удалось отвязать Telegram-чат')
    return
  }
  pushToast('ok', 'Telegram-чат отвязан')
  await loadSettings()
}

async function sendTestNotification() {
  const response = await fetch('/api/dashboard/integrations/notifications/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
  })
  if (!response.ok) {
    pushToast('error', 'Не удалось отправить тест')
    return
  }
  pushToast('ok', 'Тестовое уведомление отправлено')
}

onMounted(async () => {
  await load()
  await loadSettings()
})
</script>
