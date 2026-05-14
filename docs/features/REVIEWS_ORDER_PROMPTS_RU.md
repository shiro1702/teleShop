# Запрос оценки заказа (Telegram, MAX, дашборд)

Модуль `reputation_reviews_pro` (см. [REVIEWS_MODULE_ROLLOUT_RU.md](./REVIEWS_MODULE_ROLLOUT_RU.md)).

## Таблица `shop_order_review_prompts`

- Один ряд на пару `(order_id, channel)` где `channel` = `telegram` | `max`.
- `public_token` — для Telegram `callback_data` префикса `rt_<token>_<1-5|e>`.
- MAX: в сообщении ссылки `startapp=reviewrate_<orderId>_<1-5>` (оценка в мини-приложении).
- Статусы: `awaiting_send`, `sent`, `send_failed`, `completed`, `expired`.

## Планирование

- После `handed_to_customer` создаются промпты с `scheduled_for = now + NUXT_REVIEW_PROMPT_DELAY_MIN` (по умолчанию 45 минут).
- Отправка: `processDueReviewPrompts` вызывается из `dispatchNotificationEvent`, из Telegram webhook при `callback_query`, и из `POST /api/cron/review-prompts` с заголовком `x-cron-secret` = `NUXT_CRON_REVIEW_PROMPTS_SECRET`.

## Дашборд

- `GET /api/dashboard/orders/:id` — поле `order.reviewPrompt`.
- `POST /api/dashboard/orders/:id/review-prompt` — ручная постановка в очередь и немедленная попытка отправки.

## API отзыва

- `POST /api/reviews` — создание.
- `PATCH /api/reviews` — смена оценки по заказу.

## Telegram

- После выбора звезды сообщение редактируется: текст подтверждения и кнопка «Изменить оценку».
