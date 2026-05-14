# RFC: Realtime обновление статусов заказов

Статус: Draft  
Дата: 2026-04-14  
Автор: AI + команда teleShop

## 1) Контекст и проблема

Сейчас обновление статусов реализовано через короткий polling:

- `pages/dashboard/orders/kanban.vue` — `setInterval(..., 3000)` + полный `GET /api/dashboard/orders`
- `pages/dashboard/orders/manager.vue` — `setInterval(..., 3000)` + полный `GET /api/dashboard/orders`
- `pages/orders.vue` (детали заказа клиента) — `setInterval(..., 3000)` + `GET /api/client-order-status`
- `pages/dashboard/branches/[id]/kitchen.vue` — авто-polling отсутствует (обновление только при входе/смене фильтра)

Последствия:

- лишняя нагрузка на API и БД (частые полные выборки);
- задержки и рассинхрон между менеджером и кухней;
- нет единого контракта "события заказа" для realtime UI.

## 2) Цели RFC

- Дать near-realtime обновление статусов по операционным экранам.
- Снизить нагрузку от постоянного full polling.
- Сохранить tenant-изоляцию (`shop_id`, `restaurant_id`) и текущие права доступа.
- Ввести единый event payload для всех экранов.

## 3) Решение: SSE first, WS optional

### Почему SSE как базовый транспорт

- Для текущего кейса нужен преимущественно **server -> client** поток событий.
- Проще в эксплуатации, чем WebSocket, и хорошо подходит под Nuxt/Nitro endpoint.
- Авто-reconnect в браузере (`EventSource`) из коробки.

### Когда нужен WebSocket

WS оставляем как опциональный следующий шаг, если понадобится:

- bidirectional-сообщения в реальном времени;
- высокочастотные интерактивные коллаб-сценарии;
- единый сокет-хаб для большого количества типов live-событий.

В рамках этого RFC: **прод идем через SSE + fallback polling**.

## 4) Новые endpoint’ы

## 4.1 Dashboard stream (канбан, менеджер, кухня)

`GET /api/dashboard/orders/stream`

Query params:

- `restaurant_id` (optional)
- `fulfillment_type` (optional)
- `city` (optional, если понадобится на UI)
- `view` (optional: `kanban|manager|kitchen|any`) для диагностики/метрик
- `since` (optional, timestamp или event id для catch-up)

Auth:

- Через существующий `requireDashboardAccess`.
- Сервер обязан фильтровать события по `shop_id` пользователя.

Протокол:

- `Content-Type: text/event-stream`
- heartbeat событие раз в 20-30 секунд.
- reconnect hint через `retry: 3000`.

## 4.2 Client stream (экран клиента с деталями заказа)

`GET /api/client-order-status/stream?orderId=<id>`

Auth:

- Через текущую customer auth логику (как в `client-order-status.get.ts`).
- Доступ только к своему заказу.

Поведение:

- События только для указанного `orderId`.
- После финального статуса (`cancelled`, `handed_to_customer`) поток можно завершать на сервере.

## 4.3 Polling fallback endpoint (дельта)

`GET /api/dashboard/orders/changes?since=<cursor>`

Назначение:

- fallback, когда SSE недоступен;
- восстановление после долгого разрыва (reconnect catch-up).

Ответ:

- список событий/изменений после `since`;
- новый `nextCursor`.

## 5) Каналы событий (логические)

Независимо от транспорта вводим логические каналы:

- `orders.shop.<shopId>` — базовый канал магазина;
- `orders.restaurant.<restaurantId>` — уточняющий фильтр для кухни/филиала;
- `orders.order.<orderId>` — точечный канал клиента (детали заказа).

Для SSE это маппится в серверную фильтрацию внутри endpoint, без явной подписки клиента на broker topic.

## 6) Формат payload события (единый контракт)

Сервер отправляет SSE события `event: order.updated` и `event: order.created`.

Пример:

```json
{
  "eventId": "5b68e572-2218-4f8d-8ad8-f57a0c5c0af4",
  "eventType": "ORDER_STATUS_CHANGED",
  "occurredAt": "2026-04-14T10:15:21.000Z",
  "shopId": "shop_123",
  "restaurantId": "rest_7",
  "cityId": "city_1",
  "order": {
    "id": "ord_10001",
    "orderNumber": "A-1042",
    "status": "in_progress",
    "previousStatus": "new",
    "fulfillmentType": "delivery",
    "total": 1290,
    "paymentStatus": "paid",
    "updatedAt": "2026-04-14T10:15:20.400Z"
  },
  "actor": {
    "source": "dashboard",
    "userId": "user_55"
  },
  "meta": {
    "comment": "Принят в работу",
    "version": 1
  }
}
```

Минимально обязательные поля:

- `eventId`, `eventType`, `occurredAt`
- `shopId`
- `order.id`, `order.status`, `order.updatedAt`

Рекомендации:

- `eventId` использовать для дедупликации на клиенте;
- `order.updatedAt`/`meta.version` использовать для last-write-wins.

## 7) Источник событий на сервере

Используем существующие точки изменения заказа:

- создание: `server/api/order.post.ts` (`ORDER_CREATED`);
- смена статуса: `server/api/dashboard/orders/[id]/status.put.ts` (`ORDER_STATUS_CHANGED`);
- при необходимости: оплаты (`server/api/webhooks/yookassa.post.ts`) как `ORDER_PAYMENT_CHANGED`.

Технически:

- после успешной записи в БД публикуем событие в внутренний event bus;
- SSE endpoint читает этот bus и отдает только релевантные события по фильтрам и доступу.

## 8) Клиентская стратегия обновления UI

Для `kanban`/`manager`/`kitchen`:

- старт: начальный `GET` текущего снапшота;
- далее: SSE подписка;
- на событие: точечный patch локального `orders` массива;
- если patch невозможен (нет сущности) -> `silent reload` с debounce 300-500 мс.

Для `client`:

- старт: `GET /api/client-order-status`;
- далее: SSE по конкретному `orderId`;
- при ошибке SSE: fallback polling каждые 8-10 секунд, а не 3.

## 9) Минимальный rollout-план (обязательный порядок)

## Этап 1: Kanban

1. Добавить `GET /api/dashboard/orders/stream`.
2. Подключить SSE в `pages/dashboard/orders/kanban.vue`.
3. Оставить fallback polling (интервал 8-10 сек, только при разрыве SSE).
4. Проверить синхрон статуса между двумя вкладками канбана.

Критерий успеха:

- визуальная задержка обновления < 1-2 сек в нормальном соединении;
- уменьшение количества запросов `GET /api/dashboard/orders`.

## Этап 2: Manager

1. Переиспользовать тот же stream endpoint.
2. Подключить SSE в `pages/dashboard/orders/manager.vue`.
3. Убрать постоянный 3-сек polling.

Критерий успеха:

- таблица получает обновления без ручного refresh;
- фильтры и пагинация не ломаются при live patch.

## Этап 3: Kitchen

1. Подключить SSE для `restaurant_id` + `fulfillment_type`.
2. Обновлять колонки KDS и модалку деталей заказа live.
3. Добавить soft refresh, если пришло событие по заказу вне локального снапшота.

Критерий успеха:

- кухня видит смену статуса почти мгновенно;
- уменьшается число ситуаций "устаревшая карточка".

## Этап 4: Client

1. Добавить `GET /api/client-order-status/stream?orderId=...`.
2. Подключить SSE в `pages/orders.vue` (детальный блок статуса).
3. Перевести fallback polling на 8-10 сек и останавливать на финальных статусах.

Критерий успеха:

- клиент видит изменения без постоянных частых запросов;
- нет утечек доступа к чужому заказу.

## 10) Нефункциональные требования

- Tenant safety: каждое событие валидируется на `shop_id`.
- RBAC: stream endpoint использует те же проверки прав, что и list endpoint.
- Надежность: heartbeat + reconnect + idempotent update на клиенте.
- Наблюдаемость: логировать `connections_opened`, `events_sent`, `reconnects`, `fallback_activated`.

## 11) Риски и меры

- Риск: дубли событий при reconnect.  
  Мера: dedupe по `eventId` + короткий LRU cache на клиенте.

- Риск: race между локальным optimistic update и серверным событием.  
  Мера: применять событие только если `updatedAt` новее локального.

- Риск: деградация при прокси/инфре, где SSE рвется.  
  Мера: автоматический fallback на polling + endpoint `changes`.

## 12) Scope этого RFC

В scope:

- SSE endpoint’ы, event payload, client subscription/fallback, rollout по 4 экранам.

Вне scope:

- полный переход на WebSocket;
- глобальный realtime для всех доменов, не только orders.

