# iiko API Contract (mock-first)

Документ фиксирует контракт интеграции TeleShop с iiko для режима `mock -> http`.

## Режимы интеграции

- `mock`: локальный адаптер с предсказуемыми ответами.
- `http`: реальные HTTP-запросы в iiko API.

## Приоритет конфигурации

1. `shops.integration_keys.iiko` (приоритетный per-shop источник).
2. fallback `.env` (`IIKO_BASE_URL`, `IIKO_API_KEY`, `IIKO_MODE`, `IIKO_TIMEOUT_MS`).

## Tenant-контекст

Все операции выполняются в контексте:
- `shop_id` (обязательно),
- `restaurant_id` (branch-зависимые сценарии).

Обязательный маппинг филиалов:
- `restaurant_id <-> iiko_terminal_group_id`.

## Dashboard endpoints

- `GET /api/dashboard/integrations/iiko`
- `POST /api/dashboard/integrations/iiko/connect`
- `POST /api/dashboard/integrations/iiko/health-check`
- `POST /api/dashboard/integrations/iiko/menu-sync`
- `POST /api/dashboard/integrations/iiko/stoplist-sync`
- `POST /api/dashboard/integrations/iiko/orders/retry-failed`
- `POST /api/dashboard/integrations/iiko/promocodes-sync`

## Checkout / Webhook endpoints

- `POST /api/checkout/iiko/validate-promocode`
- `POST /api/webhooks/iiko/menu-availability`
- `POST /api/webhooks/iiko/order-status`

## Data model

- `iiko_restaurant_mapping`
- `iiko_sync_jobs`
- `iiko_events`
- `iiko_order_outbox`

`orders` использует:
- `external_order_id`,
- `external_status`,
- `last_sync_error`.

## Order push contract

- Идемпотентная отправка через `iiko_order_outbox`.
- Уникальность: `shop_id + order_id`, `shop_id + idempotency_key`.
- Retry/backoff с `next_retry_at`.
- После успеха: `orders.external_order_id`, `orders.external_status` обновляются.

## Promocode contract

- Валидация промокода только сервером (`/api/checkout/iiko/validate-promocode`).
- Синхронизация активных кодов в `shop_promo_codes`.

## Loyalty contract (iikoCard)

- Конфиг-флаг: `integration_keys.iiko.useIikoCardLoyalty`.
- Если флаг включен: внутреннее списание бонусов TeleShop в checkout отключается.
- Для MVP допускается read/validation-first, write-off расширяется отдельным этапом.

## Ошибки и UX

- Ошибки API не блокируют страницу dashboard.
- Пользователь получает обратную связь через toast.
- Для webhook:
  - signature header сохраняется в `iiko_events.signature`,
  - dedup по `(shop_id, external_event_id)`.
