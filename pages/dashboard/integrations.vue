<template>
  <NuxtPage v-if="isNotificationSettingsRoute" />
  <section v-else class="space-y-4">
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

    <div class="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="rounded-lg px-3 py-2 text-sm transition-colors"
        :class="activeTab === tab.id ? 'bg-primary text-white' : tab.disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'text-gray-700 hover:bg-gray-50'"
        :disabled="tab.disabled"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.disabled" class="ml-1 text-[11px]">(скоро)</span>
      </button>
    </div>

    <div v-if="activeTab === 'bots'" class="space-y-3">
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Интеграция с ботами вынесена в отдельную вкладку как будущий функционал. Сейчас рабочие уведомления менеджерам настраиваются во вкладке «Омниканальные уведомления».
      </div>
      <div class="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
        <button
          v-for="tab in botTabs"
          :key="tab.id"
          type="button"
          class="cursor-not-allowed rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-400"
          disabled
        >
          {{ tab.label }} <span class="ml-1 text-[11px]">(скоро)</span>
        </button>
      </div>
      <div v-if="restaurantsLoading" class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="animate-pulse space-y-3">
          <div class="h-4 w-44 rounded bg-gray-200" />
          <div class="h-10 rounded-lg bg-gray-100" />
          <div class="h-10 rounded-lg bg-gray-100" />
        </div>
      </div>
      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold text-gray-500">Telegram Bot</h2>
        <p class="mt-1 text-xs text-amber-700">Вкладка отключена: подключение tenant-ботов будет оформлено отдельным стабильным flow.</p>
        <p class="mt-1 text-xs text-gray-500">Webhook: {{ telegramWebhook }}</p>
        <div class="mt-3 grid gap-2 opacity-50 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block text-gray-600">Bot token</span>
            <input
              v-model="telegramTokenInput"
              type="text"
              placeholder="123456:AA..."
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled
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
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" disabled @click="connectTelegramBot">
            Подключить
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" disabled @click="reconnectTelegramBot">
            Переподключить
          </button>
          <button class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50" disabled @click="disconnectTelegramBot">
            Отключить
          </button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" disabled @click="telegramHealthy = !telegramHealthy">
            Проверить/переключить статус
          </button>
        </div>
        <p v-if="telegramMessage" class="mt-2 text-sm" :class="telegramMessageType === 'ok' ? 'text-green-700' : 'text-red-700'">
          {{ telegramMessage }}
        </p>
      </article>

      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold text-gray-500">Подключенные Telegram-боты к ресторанам</h2>
        <p class="mt-1 text-xs text-amber-700">Вкладка отключена: привязка отдельных ресторанных ботов пока не используется в боевом flow.</p>
        <div class="mt-3 grid gap-2 opacity-50 md:grid-cols-3">
          <select v-model="selectedRestaurantId" class="rounded-lg border border-gray-300 px-3 py-2 text-sm" disabled>
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
            disabled
          >
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" disabled @click="attachBotToRestaurant">
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
    </div>

    <div v-else-if="activeTab === 'notifications'" class="grid gap-3 md:grid-cols-2">
      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">Омниканальные уведомления (Telegram + MAX)</h2>
        <p class="mt-1 text-xs text-gray-500">
          Primary/Secondary задают порядок доставки. Привязка каждого канала вынесена в отдельную вкладку ниже.
        </p>
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

        <div class="mt-4 rounded-xl border border-gray-200">
          <div class="border-b border-gray-100 px-3 py-2">
            <h3 class="text-sm font-semibold text-gray-900">Филиалы и уведомления</h3>
            <p class="mt-1 text-xs text-gray-500">Выберите филиал и провалитесь глубже, чтобы настроить Telegram/MAX-группы, режим получателей и тестовую отправку.</p>
          </div>
          <div v-if="notificationRestaurantsLoading" class="divide-y divide-gray-100 px-3 py-2">
            <div v-for="item in 4" :key="item" class="animate-pulse py-3">
              <div class="h-4 w-48 rounded bg-gray-200" />
              <div class="mt-2 h-3 w-72 max-w-full rounded bg-gray-100" />
            </div>
          </div>
          <ul v-else class="divide-y divide-gray-100 text-sm">
            <li v-for="r in notificationRestaurants" :key="r.id" class="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div>
                <p class="font-medium text-gray-900">{{ r.name }}</p>
                <p class="text-xs text-gray-500">
                  Telegram: {{ r.managerGroupChatId || 'не задан' }} • MAX: {{ r.managerMaxChatId || 'не задан' }} • режим: {{ r.managerNotificationMode === 'personal' ? 'персональные' : 'группа' }}
                </p>
              </div>
              <NuxtLink :to="`/dashboard/integrations/notifications/${r.id}`" class="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                Настроить
              </NuxtLink>
            </li>
            <li v-if="!notificationRestaurants.length" class="px-3 py-4 text-sm text-gray-500">
              Филиалов на этой странице нет.
            </li>
          </ul>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <button
            class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
            :disabled="!notificationRestaurantsHasPrev"
            @click="changeNotificationRestaurantsPage(-1)"
          >
            Рестораны: назад
          </button>
          <button
            class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
            :disabled="!notificationRestaurantsHasNext"
            @click="changeNotificationRestaurantsPage(1)"
          >
            Рестораны: вперед
          </button>
          <span>по {{ notificationRestaurantsPageSize }} на странице</span>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            v-for="tab in notificationChannelTabs"
            :key="tab.id"
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition-colors"
            :class="activeNotificationChannelTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-white/70'"
            @click="activeNotificationChannelTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
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
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <button
            class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
            :disabled="!notificationEventsHasPrev"
            @click="changeNotificationEventsPage(-1)"
          >
            Event-log: назад
          </button>
          <span>страница {{ notificationEventsPage }}</span>
          <button
            class="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
            :disabled="!notificationEventsHasNext"
            @click="changeNotificationEventsPage(1)"
          >
            Event-log: вперед
          </button>
          <span>по {{ notificationEventsPageSize }} на странице</span>
        </div>
      </article>

      <article class="rounded-xl border border-gray-200 bg-white p-4">
        <h2 class="text-sm font-semibold">API key (masked)</h2>
        <p class="mt-1 text-xs text-gray-500">{{ maskedApiKey }}</p>
        <button class="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="rotateKey">
          Ротировать ключ
        </button>
      </article>
    </div>

    <div v-else-if="activeTab === 'quickresto'" class="grid gap-3 md:grid-cols-2">
      <article class="rounded-xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
        <h2 class="text-sm font-semibold text-amber-900">Quick Resto</h2>
        <p class="mt-1 text-sm text-amber-800">Вкладка отключена как будущий/служебный функционал. Текущие элементы оставлены ниже только для справки и неактивны.</p>
      </article>
      <article class="pointer-events-none rounded-xl border border-gray-200 bg-white p-4 opacity-50 md:col-span-2">
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

    <div v-else-if="activeTab === 'iiko'" class="grid gap-3 md:grid-cols-2">
      <article class="rounded-xl border border-gray-200 bg-white p-4 md:col-span-2">
        <h2 class="text-sm font-semibold">iiko</h2>
        <p class="mt-1 text-xs text-gray-500">Подключение, синхронизация меню/стоп-листов, ретраи заказов и промокоды.</p>
        <div class="mt-3 grid gap-2 md:grid-cols-5">
          <select v-model="iikoMode" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="mock">mock</option>
            <option value="http">http</option>
          </select>
          <input v-model="iikoBaseUrl" type="text" placeholder="https://api-ru.iiko.services" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <input v-model="iikoApiKey" type="text" placeholder="API key" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <label class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input v-model="iikoStrictMode" type="checkbox">
            strict mode
          </label>
          <label class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input v-model="iikoUseIikoCardLoyalty" type="checkbox">
            iikoCard вместо наших бонусов
          </label>
        </div>
        <div class="mt-3 grid gap-2 md:grid-cols-3">
          <select v-model="iikoMappingRestaurantId" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Филиал для маппинга</option>
            <option v-for="restaurant in restaurants" :key="restaurant.id" :value="restaurant.id">{{ restaurant.name }}</option>
          </select>
          <input v-model="iikoMappingTerminalGroupId" type="text" placeholder="iiko_terminal_group_id" class="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <button class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="saveIikoConnection">Сохранить подключение</button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoHealth">Проверить подключение</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoMenuSync(false)">Синхронизировать меню</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoMenuSync(true)">Dry-run sync</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoStopListSync">Синхронизировать стоп-листы</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoRetryOrders">Переотправить проблемные заказы</button>
          <button class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="role !== 'owner'" @click="runIikoPromoSync">Синхронизировать промокоды</button>
        </div>
        <p class="mt-2 text-xs text-gray-600">Mode: {{ iikoInfo.mode }} | Health: {{ iikoInfo.healthMessage }}</p>
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
                  <tr v-for="job in iikoJobs" :key="job.id" class="border-t border-gray-100">
                    <td class="py-1 pr-2">{{ job.job_type }}</td>
                    <td class="py-1 pr-2">{{ job.status }}</td>
                    <td class="py-1 pr-2">{{ job.mode }}</td>
                    <td class="py-1">{{ formatTs(job.created_at) }}</td>
                  </tr>
                  <tr v-if="!iikoJobs.length">
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
                  <tr v-for="eventItem in iikoEvents" :key="eventItem.id" class="border-t border-gray-100">
                    <td class="py-1 pr-2">{{ eventItem.event_type }}</td>
                    <td class="py-1 pr-2">{{ eventItem.external_event_id }}</td>
                    <td class="py-1 pr-2">{{ eventItem.error ? 'error' : eventItem.processed_at ? 'processed' : 'new' }}</td>
                    <td class="py-1">{{ formatTs(eventItem.created_at) }}</td>
                  </tr>
                  <tr v-if="!iikoEvents.length">
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
const route = useRoute()
const isNotificationSettingsRoute = computed(() => route.path.startsWith('/dashboard/integrations/notifications/'))
const { role, load } = useDashboardAccess()
type IntegrationTabId = 'notifications' | 'bots' | 'quickresto' | 'iiko'
type NotificationChannelTabId = 'telegram' | 'max' | 'recipients'
const activeTab = ref<IntegrationTabId>('notifications')
const activeNotificationChannelTab = ref<NotificationChannelTabId>('telegram')
const tabs: Array<{ id: IntegrationTabId; label: string; disabled?: boolean }> = [
  { id: 'notifications', label: 'Омниканальные уведомления' },
  { id: 'bots', label: 'Интеграция с ботами' },
  { id: 'quickresto', label: 'Quick Resto', disabled: true },
  { id: 'iiko', label: 'iiko' },
]
const notificationChannelTabs: Array<{ id: NotificationChannelTabId; label: string }> = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'max', label: 'MAX' },
  { id: 'recipients', label: 'Получатели' },
]
const botTabs = [
  { id: 'telegram-bot', label: 'Telegram Bot' },
  { id: 'restaurant-bots', label: 'Боты ресторанов' },
]
const telegramWebhook = ref('https://api.teleshop.app/webhook/telegram')
const telegramHealthy = ref(true)
const telegramToken = ref('tg_live_12fd9aabce98')
const telegramTokenInput = ref('')
const telegramConnected = ref(false)
const telegramMessage = ref('')
const telegramMessageType = ref<'ok' | 'error'>('ok')

type Restaurant = { id: string; name: string }
const restaurants = ref<Restaurant[]>([])
const restaurantsLoading = ref(false)
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
const notificationRestaurantsPage = ref(1)
const notificationRestaurantsPageSize = 25
const notificationRestaurantsHasNext = ref(false)
const notificationRestaurantsHasPrev = ref(false)
const notificationRestaurantsLoading = ref(false)
const notificationEventsPage = ref(1)
const notificationEventsPageSize = 25
const notificationEventsHasNext = ref(false)
const notificationEventsHasPrev = ref(false)
const telegramChatBindDeepLink = ref('')
const telegramChatBindCommand = ref('')
const telegramChatBindExpiresAt = ref('')
const festivalModerationFestivals = ref<Array<{ id: string; slug: string; name: string }>>([])
const festivalModerationChats = ref<Array<{ id: string; festivalId: string; telegramChatId: string; maxChatId: string; isActive: boolean; updatedAt: string }>>([])
const festivalModerationFestivalId = ref('')
const festivalModerationTelegramChatId = ref('')
const festivalModerationMaxChatId = ref('')
const festivalModerationIsActive = ref(true)

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
const iikoMode = ref<'mock' | 'http'>('mock')
const iikoBaseUrl = ref('')
const iikoApiKey = ref('')
const iikoStrictMode = ref(false)
const iikoUseIikoCardLoyalty = ref(false)
const iikoMappingRestaurantId = ref('')
const iikoMappingTerminalGroupId = ref('')
const iikoInfo = ref<{ mode: string; healthMessage: string }>({ mode: 'mock', healthMessage: '—' })
const iikoJobs = ref<Array<{ id: string; job_type: string; status: string; mode: string; created_at: string }>>([])
const iikoEvents = ref<Array<{ id: string; event_type: string; external_event_id: string; error: string | null; processed_at: string | null; created_at: string }>>([])

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

async function loadRestaurants() {
  restaurantsLoading.value = true
  try {
    const response = await fetch('/api/dashboard/restaurants?compact=1&pageSize=100')
    if (!response.ok) return
    const payload = await response.json() as { items?: Array<{ id: string; name: string }> }
    restaurants.value = Array.isArray(payload.items) ? payload.items : []
  } catch {
    restaurants.value = []
  } finally {
    restaurantsLoading.value = false
  }
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
  notificationRestaurantsLoading.value = true
  const params = new URLSearchParams({
    page: String(notificationRestaurantsPage.value),
    pageSize: String(notificationRestaurantsPageSize),
  })
  try {
    const response = await fetch(`/api/dashboard/integrations/notifications?${params.toString()}`)
    if (!response.ok) return
    const payload = await response.json()
    channelPolicy.value = payload.channelPolicy ?? channelPolicy.value
    notificationRestaurants.value = Array.isArray(payload.restaurants) ? payload.restaurants : []
    notificationRestaurantsHasNext.value = payload?.pagination?.hasNext === true
    notificationRestaurantsHasPrev.value = payload?.pagination?.hasPrev === true
    if (notificationRestaurantId.value && !notificationRestaurants.value.some((item: { id: string }) => item.id === notificationRestaurantId.value)) {
      notificationRestaurantId.value = ''
    }
  } finally {
    notificationRestaurantsLoading.value = false
  }
}

async function changeNotificationRestaurantsPage(delta: number) {
  const next = Math.max(1, notificationRestaurantsPage.value + delta)
  if (next === notificationRestaurantsPage.value) return
  notificationRestaurantsPage.value = next
  await loadNotificationSettings()
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

async function loadIikoState() {
  const response = await fetch('/api/dashboard/integrations/iiko')
  if (!response.ok) return
  const payload = await response.json()
  const cfg = payload?.config ?? {}
  iikoMode.value = cfg.mode === 'http' ? 'http' : 'mock'
  iikoBaseUrl.value = typeof cfg.baseUrl === 'string' ? cfg.baseUrl : ''
  iikoStrictMode.value = cfg.strictMode === true
  iikoUseIikoCardLoyalty.value = cfg.useIikoCardLoyalty === true
  iikoInfo.value = {
    mode: iikoMode.value,
    healthMessage: cfg.hasApiKey ? 'api key configured' : 'api key is empty',
  }
  iikoJobs.value = Array.isArray(payload?.jobs) ? payload.jobs : []
  iikoEvents.value = Array.isArray(payload?.events) ? payload.events : []
}

async function saveIikoConnection() {
  const restaurantMappings = iikoMappingRestaurantId.value && iikoMappingTerminalGroupId.value
    ? [{ restaurantId: iikoMappingRestaurantId.value, iikoTerminalGroupId: iikoMappingTerminalGroupId.value }]
    : []
  const response = await fetch('/api/dashboard/integrations/iiko/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: iikoMode.value,
      baseUrl: iikoBaseUrl.value,
      apiKey: iikoApiKey.value,
      strictMode: iikoStrictMode.value,
      useIikoCardLoyalty: iikoUseIikoCardLoyalty.value,
      restaurantMappings,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось сохранить iiko подключение')
    return
  }
  const isHealthy = payload?.health?.ok === true
  iikoInfo.value = { mode: payload.mode || iikoMode.value, healthMessage: payload?.health?.message || 'saved' }
  if (!isHealthy) {
    pushToast('error', payload?.health?.message || 'iiko подключен, но health-check не пройден')
    return
  }
  pushToast('ok', 'iiko подключение сохранено и health-check пройден')
  await loadIikoState()
}

async function runIikoHealth() {
  const response = await fetch('/api/dashboard/integrations/iiko/health-check', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Health-check не выполнен')
    return
  }
  iikoInfo.value = { mode: payload.mode || iikoMode.value, healthMessage: payload.message || 'OK' }
  pushToast(payload.ok ? 'ok' : 'error', payload.message || 'Health-check завершен')
}

async function runIikoMenuSync(dryRun: boolean) {
  const response = await fetch('/api/dashboard/integrations/iiko/menu-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Menu sync не выполнен')
  pushToast('ok', dryRun ? `Dry-run: ${payload?.diff?.length || 0} изменений` : 'Синхронизация меню завершена')
  await loadIikoState()
}

async function runIikoStopListSync() {
  const response = await fetch('/api/dashboard/integrations/iiko/stoplist-sync', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Stop-list sync не выполнен')
  pushToast('ok', 'Стоп-листы синхронизированы')
  await loadIikoState()
}

async function runIikoRetryOrders() {
  const response = await fetch('/api/dashboard/integrations/iiko/orders/retry-failed', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Retry failed orders не выполнен')
  pushToast('ok', `Отправлено: ${payload.sent || 0}, ошибок: ${payload.failed || 0}`)
  await loadIikoState()
}

async function runIikoPromoSync() {
  const response = await fetch('/api/dashboard/integrations/iiko/promocodes-sync', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return pushToast('error', payload?.statusMessage || 'Promo sync не выполнен')
  pushToast('ok', `Промокодов синхронизировано: ${payload.synced || 0}`)
  await loadIikoState()
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
  const params = new URLSearchParams({
    page: String(notificationEventsPage.value),
    pageSize: String(notificationEventsPageSize),
  })
  if (notificationRestaurantId.value) params.set('restaurantId', notificationRestaurantId.value)
  const response = await fetch(`/api/dashboard/integrations/notification-events?${params.toString()}`)
  if (!response.ok) return
  const payload = await response.json()
  notificationEvents.value = Array.isArray(payload.items) ? payload.items : []
  notificationEventsHasNext.value = payload?.pagination?.hasNext === true
  notificationEventsHasPrev.value = payload?.pagination?.hasPrev === true
}

async function changeNotificationEventsPage(delta: number) {
  const next = Math.max(1, notificationEventsPage.value + delta)
  if (next === notificationEventsPage.value) return
  notificationEventsPage.value = next
  await loadNotificationEvents()
}

function syncFestivalModerationSelection() {
  const selected = festivalModerationChats.value.find((x: { festivalId: string }) => x.festivalId === festivalModerationFestivalId.value)
  if (!selected) {
    festivalModerationTelegramChatId.value = ''
    festivalModerationMaxChatId.value = ''
    festivalModerationIsActive.value = true
    return
  }
  festivalModerationTelegramChatId.value = selected.telegramChatId || ''
  festivalModerationMaxChatId.value = selected.maxChatId || ''
  festivalModerationIsActive.value = selected.isActive !== false
}

async function loadFestivalModerationSettings() {
  const response = await fetch('/api/dashboard/integrations/festival-moderation')
  if (!response.ok) {
    pushToast('error', 'Не удалось загрузить настройки модерации фестиваля')
    return
  }
  const payload = await response.json().catch(() => ({}))
  festivalModerationFestivals.value = Array.isArray(payload.festivals) ? payload.festivals : []
  festivalModerationChats.value = Array.isArray(payload.chats) ? payload.chats : []
  if (!festivalModerationFestivalId.value && festivalModerationFestivals.value.length) {
    festivalModerationFestivalId.value = festivalModerationFestivals.value[0].id
  }
  syncFestivalModerationSelection()
}

async function saveFestivalModerationSettings() {
  if (!festivalModerationFestivalId.value) return
  const response = await fetch('/api/dashboard/integrations/festival-moderation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      festivalId: festivalModerationFestivalId.value,
      telegramChatId: festivalModerationTelegramChatId.value,
      maxChatId: festivalModerationMaxChatId.value,
      isActive: festivalModerationIsActive.value,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось сохранить чат модерации фестиваля')
    return
  }
  pushToast('ok', 'Настройки чата модерации фестиваля сохранены')
  await loadFestivalModerationSettings()
}

async function sendFestivalModerationTest() {
  if (!festivalModerationFestivalId.value) return
  const response = await fetch('/api/dashboard/integrations/festival-moderation/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      festivalId: festivalModerationFestivalId.value,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    pushToast('error', payload?.statusMessage || 'Не удалось отправить тест в чат модерации')
    return
  }
  const channels = Array.isArray(payload.sent) ? payload.sent.join(', ') : 'channel'
  pushToast('ok', `Тест отправлен: ${channels}`)
}

onMounted(async () => {
  if (isNotificationSettingsRoute.value) return
  await load()
  await Promise.all([
    loadRestaurants(),
    loadNotificationSettings(),
    loadNotificationEvents(),
    loadFestivalModerationSettings(),
    loadQuickRestoState(),
    loadIikoState(),
  ])
})

watch(notificationRestaurantId, () => {
  telegramChatBindDeepLink.value = ''
  telegramChatBindCommand.value = ''
  telegramChatBindExpiresAt.value = ''
  notificationEventsPage.value = 1
  syncSelectedNotificationRestaurant()
  void loadNotificationEvents()
})

watch(festivalModerationFestivalId, () => {
  syncFestivalModerationSelection()
})
</script>
