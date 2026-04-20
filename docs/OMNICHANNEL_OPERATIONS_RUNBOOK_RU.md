# Runbook омниканальных уведомлений (Telegram + MAX)

## Что мониторим

- `notification_events.delivery_status`:
  - `failed` - ошибки доставки;
  - `retrying` - уведомления в backoff;
  - `sent` - успешная доставка.
- всплеск `attempt_count > 3` за последние 15 минут;
- доля fallback-событий (ошибка MAX и повтор через Telegram).

## Базовые алерты

1. `failed` > 20 за 10 минут по одному `shop_id`.
2. `retrying` > 50 за 10 минут по одному `shop_id`.
3. доля `failed` > 5% от всех событий за 30 минут.

## Процедура разбора инцидента

1. Открыть `/dashboard/integrations` и обновить event-log.
2. Отфильтровать по `shop_id`, `restaurant_id`, `channel`, `delivery_status`.
3. Проверить `last_error` и `attempt_count`.
4. Для MAX:
   - убедиться, что `channel_policy.maxEnabled=true`;
   - проверить валидность `maxApiBaseUrl` и `maxApiToken`;
   - проверить `manager_max_chat_id` или `manager_recipients`.
5. Для Telegram:
   - проверить `telegram_bot_token`;
   - проверить `manager_group_chat_id` или `manager_recipients`.

## Ручной retry

1. Исправить конфиг канала/получателя.
2. Нажать `Проверить уведомление` в интеграциях.
3. При успехе выполнить повтор бизнес-события (из заказа/статуса) штатным действием.

## Rollout-порядок

1. Включить логирование и `ChannelRouter` при `maxEnabled=false`.
2. Включить MAX для 1-2 пилотных ресторанов.
3. Проверить retry/fallback на тестовом событии.
4. Расширять на остальные рестораны поэтапно.
