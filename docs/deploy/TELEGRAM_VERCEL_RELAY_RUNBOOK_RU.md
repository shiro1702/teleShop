# RUNBOOK: Vercel-прослойка для Telegram webhook и исходящих сообщений

Документ описывает альтернативу WireGuard: вынести Telegram-взаимодействие в отдельную прослойку на Vercel.

Цель:
- Telegram доставляет webhook в Vercel (обычно доступно и стабильно);
- Vercel быстро отвечает `200 OK` (без долгой бизнес-логики);
- Vercel пересылает апдейт в ваш backend (`pocketmenu.ru`) по внутреннему секрету;
- ваш backend для ответов в Telegram использует relay endpoint на Vercel (а не прямой `api.telegram.org`).

Такой подход обходит проблему сетевой недоступности Telegram API с RU VPS.

---

## 1) Когда этот подход лучше WG

Выбирайте Vercel relay, если:
- нужен быстрый запуск без администрирования VPN на VPS;
- хочется минимально трогать сетевой стек сервера;
- хотите централизованно логировать Telegram edge-события в облаке.

WG split-tunnel лучше, если нужен полный контроль сети и минимум внешних зависимостей.

---

## 2) Архитектура

Поток входящих:
1. Telegram -> `https://<relay>.vercel.app/api/telegram/webhook`
2. Relay валидирует секрет (опционально `X-Telegram-Bot-Api-Secret-Token`)
3. Relay сразу возвращает `200 { ok: true }`
4. Relay асинхронно `POST` в ваш backend:
   - `https://pocketmenu.ru/api/webhook-relay`
   - заголовок `x-relay-secret: <RELAY_SHARED_SECRET>`

Поток исходящих:
1. Ваш backend вызывает:
   - `https://<relay>.vercel.app/api/telegram/send`
2. Relay отправляет запрос в `https://api.telegram.org/bot<TOKEN>/<method>`
3. Relay возвращает результат backend-у.

Итог: на RU VPS больше нет прямого вызова Telegram API.

---

## 3) Что нужно подготовить

- Новый проект на Vercel (например `teleshop-telegram-relay`).
- Переменные в Vercel:
  - `TELEGRAM_BOT_TOKEN`
  - `BACKEND_WEBHOOK_URL` = `https://pocketmenu.ru/api/webhook-relay`
  - `RELAY_SHARED_SECRET` = длинный случайный секрет (32+ байт)
  - `TELEGRAM_WEBHOOK_SECRET` (опционально, для Bot API `secret_token`)
- Переменные в вашем backend:
  - `TELEGRAM_RELAY_URL` = `https://<relay>.vercel.app/api/telegram/send`
  - `RELAY_SHARED_SECRET` (тот же, что на Vercel)

---

## 4) Минимальный API relay (Vercel)

Ниже reference-структура:

- `POST /api/telegram/webhook`
  - принимает Telegram update;
  - проверяет `TELEGRAM_WEBHOOK_SECRET` (если включен);
  - делает async forward в `BACKEND_WEBHOOK_URL`;
  - возвращает `200` немедленно.

- `POST /api/telegram/send`
  - принимает JSON:
    - `method` (`sendMessage`, `answerCallbackQuery`, ...)
    - `payload` (body для Telegram API)
  - проверяет `x-relay-secret`;
  - проксирует в Telegram API;
  - возвращает status/body upstream-а.

- `GET /api/health`
  - ping endpoint для аптайма и проверок.

---

## 5) Контракт webhook forward

Relay -> backend (`/api/webhook-relay`) отправляет:

Заголовки:
- `content-type: application/json`
- `x-relay-secret: <RELAY_SHARED_SECRET>`
- `x-relay-source: vercel-telegram`

Body:
- оригинальный Telegram update без преобразований.

На backend обязательно:
- проверять `x-relay-secret`;
- на невалидный секрет отвечать `403`;
- на валидный — обрабатывать update.

---

## 6) Изменения в вашем backend

## 6.1 Новый endpoint

Добавить `POST /api/webhook-relay`:
- это копия текущего `/api/webhook`, но:
  - доступ только по `x-relay-secret`;
  - можно оставить старый `/api/webhook` как fallback или отключить.

## 6.2 Адаптер отправки Telegram

Сейчас у вас прямой вызов Telegram API в `server/api/webhook.post.ts` через функцию `telegram(...)`.

Нужно вынести в `server/utils/telegramTransport.ts`:
- режим `direct` (legacy);
- режим `relay` (через `TELEGRAM_RELAY_URL`).

Рекомендуемый флаг:
- `TELEGRAM_TRANSPORT=relay|direct`

В `relay` режиме:
- backend больше не ходит на `api.telegram.org`;
- только в `TELEGRAM_RELAY_URL`.

---

## 7) Настройка webhook у Telegram на Vercel

После деплоя relay:

```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<relay>.vercel.app/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверка:

```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Ожидается:
- `url` указывает на Vercel endpoint;
- ошибок timeout от вашего VPS больше нет.

---

## 8) Пошаговый план внедрения (без простоя)

1. Поднять relay на Vercel (еще не переключая webhook).
2. Добавить `/api/health` и проверить доступность.
3. Реализовать backend endpoint `/api/webhook-relay` с проверкой `x-relay-secret`.
4. Реализовать `TELEGRAM_TRANSPORT=relay` в backend.
5. Включить `TELEGRAM_TRANSPORT=relay` в pretest, прогнать smoke:
   - `/start`
   - callback кнопки
   - `sendMessage`/`answerCallbackQuery`.
6. Переключить Telegram webhook на Vercel.
7. Проверить `getWebhookInfo` и прод-логи.
8. Оставить старый `/api/webhook` как rollback окно.

---

## 9) Проверки после переключения

1. `getWebhookInfo`:
   - `pending_update_count` не растет;
   - `last_error_message` пусто.
2. Логи Vercel:
   - webhook принимается стабильно;
   - forward в backend без 5xx.
3. Логи backend:
   - события приходят в `/api/webhook-relay`;
   - исходящие Telegram-вызовы идут через relay endpoint.
4. E2E сценарии:
   - `/start`
   - логин через Telegram
   - менеджерские callback-кнопки.

---

## 10) Безопасность

- Не принимать relay-трафик без `x-relay-secret`.
- Ограничить методы в `/api/telegram/send` whitelist-ом:
  - например `sendMessage`, `editMessageText`, `answerCallbackQuery`, `getChatMember`.
- Ограничить размер body.
- Добавить rate limit на relay endpoints.
- В логах маскировать токены и секреты.

---

## 11) Роллбек

Если relay ведет себя нестабильно:

1. Вернуть webhook на старый URL:

```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://pocketmenu.ru/api/webhook"
```

2. На backend вернуть:
- `TELEGRAM_TRANSPORT=direct`

3. Проверить `getWebhookInfo` и рабочие сценарии.

---

## 12) Риски и примечания

- Это добавляет внешний критичный компонент (Vercel relay).
- Для надежности лучше:
  - отдельный проект Vercel;
  - мониторинг + alerts;
  - минималистичный код relay без тяжелой бизнес-логики.
- Лучший operational pattern:
  - relay принимает/проксирует;
  - вся бизнес-логика остается в вашем backend.

---

## 13) Что делать прямо сейчас (коротко)

1. Создать Vercel проект `teleshop-telegram-relay`.
2. Развернуть 2 endpoint-а: `/api/telegram/webhook`, `/api/telegram/send`.
3. Добавить в ваш backend:
   - `/api/webhook-relay`
   - `TELEGRAM_TRANSPORT=relay`.
4. Переключить webhook Telegram на Vercel URL.
5. Проверить `getWebhookInfo` + E2E.

