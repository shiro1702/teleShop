# План интеграции TeleShop с iiko

## Scope

### P0
- connect + health-check;
- ручной menu sync из dashboard;
- stop-list sync;
- наблюдаемость jobs/events.

### P1
- отправка заказов через outbox/retry/idempotency;
- синхронизация внешнего статуса заказа.

### P2
- iikoCard как источник бонусной логики;
- интеграция промокодов iiko.

## Техническая реализация

- Конфиг: `shops.integration_keys.iiko`.
- Клиент: `server/utils/iiko.ts`.
- Dashboard API: `server/api/dashboard/integrations/iiko/*`.
- Checkout API: `server/api/checkout/iiko/validate-promocode.post.ts`.
- Webhooks: `server/api/webhooks/iiko/*`.
- Data model: `supabase/migrations/041_iiko_integration.sql`.

## Ключевые гарантии

- tenant isolation (`shop_id`, `restaurant_id`);
- dedup webhook событий по `external_event_id`;
- неблокирующий UX (toast feedback для dashboard API);
- единая outbox-модель доставки заказов во внешнюю систему.

## Лояльность

- Флаг `integration_keys.iiko.useIikoCardLoyalty` отключает внутреннее списание бонусов TeleShop.
- В MVP поддержан policy switch; расширение write-off flow iikoCard выполняется отдельной итерацией.

## Deliverables

- `docs/integrations/iiko-api-contract.md`
- `docs/integrations/iiko-test-plan-ru.md`
- `supabase/migrations/041_iiko_integration.sql`
- backend/api/ui реализация вкладки iiko в `/dashboard/integrations`.
