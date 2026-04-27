# План тестирования интеграции iiko

## 1) Цель

- Подтвердить стабильность iiko-интеграции в tenant-контексте `shop_id/restaurant_id`.
- Проверить, что ошибки внешнего API не ломают dashboard/checkout.

## 2) Scope

- connect/health-check;
- menu sync + stop-list;
- order push + retry;
- order status webhook;
- promocode validate/sync;
- переключение лояльности на iikoCard.

## 3) Окружения

- `mock` (обязательный smoke);
- `http` (sandbox/prod доступы iiko).

## 4) Подготовка

- Применить миграции, включая `041_iiko_integration.sql`.
- Настроить `shops.integration_keys.iiko`.
- Заполнить минимум один `restaurant_id <-> iiko_terminal_group_id`.

## 5) Тест-шаги

### A. Smoke mock

- Выполнить connect + health-check.
- Запустить dry-run и run для menu-sync.
- Запустить stop-list sync, promocodes sync.

PASS:
- действия завершаются без падения страницы,
- видны тосты и обновления jobs/events.

### B. Orders + retry

- Создать заказ в storefront.
- Проверить запись в `iiko_order_outbox`.
- Выполнить retry failed orders.

PASS:
- успешная отправка получает `external_order_id`,
- ошибки отображаются и переотправляются без дублей.

### C. Order status webhook

- Отправить `POST /api/webhooks/iiko/order-status` с `externalOrderId`.

PASS:
- `orders.external_status` обновлен,
- событие записано в `iiko_events`.

### D. Promocodes

- Проверить `POST /api/checkout/iiko/validate-promocode` (валидный/невалидный).
- Выполнить `promocodes-sync`.

PASS:
- валидный код возвращает discount,
- невалидный возвращает причину,
- коды синхронизированы в `shop_promo_codes`.

### E. iikoCard policy

- Включить `useIikoCardLoyalty=true`.
- Попробовать списать бонусы TeleShop в checkout.

PASS:
- checkout запрещает внутреннее списание бонусов с понятной ошибкой.

## 6) Нефункциональные проверки

- нет tenant leakage между магазинами;
- dedup webhook событий работает;
- outbox retry восстанавливает отправку после частичных отказов.

## 7) Rollout / rollback

Rollout:
1. 1 пилотный ресторан (mock),
2. тот же ресторан в http,
3. постепенное включение по магазинам.

Rollback:
- переключить `mode` обратно в `mock` или отключить `integration_keys.iiko`;
- остановить retry/dispatch процессы;
- сохранить инцидентные записи jobs/events.
