# Quick Resto API Contract (mock-first)

Этот документ фиксирует контракт интеграции TeleShop с Quick Resto до получения production credentials.

## Режимы интеграции

- `mock`: все запросы обрабатываются локальным адаптером, предсказуемые ответы без внешнего API.
- `http`: реальные HTTP-запросы в Quick Resto API (включается флагом на магазине).

## Приоритет конфигурации (важно)

Конфигурация Quick Resto читается в следующем порядке:

1. `shops.integration_keys.quickresto` (per-shop override, приоритетный источник);
2. fallback на `.env` (`QUICKRESTO_BASE_URL`, `QUICKRESTO_API_KEY`, `QUICKRESTO_MODE`, `QUICKRESTO_TIMEOUT_MS`).

Это нужно для:
- безопасной мультитенантности (каждый `shop` может иметь свой режим и ключи);
- удобной локальной разработки и демо (глобальные env-дефолты);
- плавного перехода `mock -> http` без массового обновления всех магазинов вручную.

## Tenant-контекст

Все операции выполняются в контексте:
- `shop_id` (обязательно)
- `restaurant_id` (для branch-зависимых операций)

Требуемый маппинг филиала: `restaurant_id <-> quickresto_place_id`.

## Connect / Health

### `POST /api/dashboard/integrations/quickresto/connect`
- сохраняет настройки интеграции в `shops.integration_keys.quickresto`.
- payload:
  - `baseUrl?: string`
  - `apiKey?: string`
  - `mode?: "mock" | "http"`
  - `strictMode?: boolean`
  - `restaurantMappings?: Array<{ restaurantId: string; quickrestoPlaceId: string }>`

### `POST /api/dashboard/integrations/quickresto/health-check`
- проверяет подключение через активный адаптер.
- response:
  - `ok: boolean`
  - `mode: "mock" | "http"`
  - `message: string`

## Menu Sync

### `POST /api/dashboard/integrations/quickresto/menu-sync`
- payload:
  - `dryRun?: boolean`
  - `restaurantId?: string`
- действие:
  - получает меню из адаптера;
  - выполняет upsert категорий/продуктов по `external_id`;
  - в `dryRun` только возвращает diff.

### `POST /api/dashboard/integrations/quickresto/stoplist-sync`
- payload:
  - `restaurantId?: string`
- действие:
  - обновляет `restaurant_product_overrides.is_in_stop_list` точечно.

### `POST /api/webhooks/quickresto/menu-availability`
- payload:
  - `shopId: string`
  - `externalEventId: string`
  - `quickrestoPlaceId: string`
  - `items: Array<{ externalProductId: string; inStopList: boolean }>`
- гарантия:
  - dedup по `(shop_id, external_event_id)` в `quickresto_events`.

## Order Push

### Outbox table
- `quickresto_order_outbox` используется как надежная очередь.
- idempotency: `idempotency_key` уникален в рамках `shop_id`.

### Worker contract (`quickresto:order-dispatch`)
- выбирает `pending/failed` с `next_retry_at <= now()`.
- при успехе:
  - `status = sent`
  - записывает `external_order_id`
  - обновляет `orders.external_order_id`, `orders.external_status`.
- при ошибке:
  - `status = failed`
  - увеличивает `attempts`
  - заполняет `last_error`
  - ставит `next_retry_at` по backoff.

## Loyalty / Promocodes

### `POST /api/checkout/quickresto/validate-promocode`
- серверная проверка промокода через адаптер.
- response:
  - `ok: boolean`
  - `valid: boolean`
  - `reason?: string`
  - `discountAmount?: number`

### `POST /api/dashboard/integrations/quickresto/promocodes-sync`
- синхронизирует промокоды из адаптера в `shop_promo_codes`.

## Ошибки и наблюдаемость

- Для фоновых задач: `quickresto_sync_jobs`.
- Для webhook/событий: `quickresto_events`.
- Ошибки не должны ломать checkout:
  - `strictMode=true`: отказ при критичной невалидности внешнего контура.
  - `strictMode=false` (`grace`): заказ создается, отправка идет через outbox/ретраи.
