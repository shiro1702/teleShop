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

---

## 14) Отдельный репозиторий: структура папок (рекомендация)

Основной магазин — Nuxt; **релею Nuxt не нужен** (тонкий HTTP-слой). Репозиторий только под прослойку, например `teleShop-telegram-relay` или `pocketmenu-telegram-relay`.

Пример дерева:

```text
teleShop-telegram-relay/          # отдельный GitHub-репозиторий
  README.md
  package.json
  vercel.json
  .env.example
  src/
    server/                       # или api/ — по шаблону Vercel
      api/
        health.get.ts
        telegram/
          webhook.post.ts
          send.post.ts
    lib/
      config.ts
      forwardToBackend.ts
      invokeTelegramApi.ts
  types/
    relay.ts                      # DTO (опционально; можно дублировать в teleShop)
```

Принцип: в реле **нет** полноценного Nuxt — только маршруты, `fetch`, проверка секретов, прокси.

---

## 15) Варианты стека для Vercel-прослойки

| Вариант | Суть | Плюсы | Минусы |
|--------|------|--------|--------|
| **A. Vercel Serverless (Node) + `fetch`** | 2–3 handler-а без фреймворка | Минимум зависимостей, прозрачно | Всё вручную |
| **B. Hono** (`hono/vercel`) | Маршруты + middleware | Удобные секреты, rate limit | Лишняя зависимость на крошечном сервисе |
| **C. Nitro standalone** | Мини-проект только с роутами (тот же стек, что у Nuxt под капотом) | Единый стиль с основным приложением | Больше настройки CI, чем у «голого» Vercel API |
| **D. Vercel Edge** | Прокси на Edge | Низкая задержка | Ограничения Node API; для Bot API чаще проще **Node runtime** |

**Рекомендация:** **A** или **B**. Полноценный Nuxt в реле **не** поднимать — лишний бандл и поверхность.

---

## 16) Где хранить код: отдельный репо vs папка в монорепо

| Подход | Плюсы | Минусы |
|--------|--------|--------|
| **Отдельный репозиторий + отдельный Vercel-проект** | Изоляция секретов, независимый деплой/роллбек, узкий доступ к репо | Два репозитория; контракт держать синхронно |
| **Монорепо:** `packages/telegram-relay` (pnpm/npm workspaces) | Один PR может обновить relay и контракт backend | Нужны два Vercel-проекта с разным Root Directory |
| **Отдельная ветка только под relay** | Быстрый старт | Не рекомендуется долгосрочно (дрейф веток) |

**Практично:** отдельный репо `teleShop-telegram-relay`, если не хотите усложнять CI. Монорепо — если важен единый PR и общие `types/`.

**Версионирование контракта:** при смене формата — заголовок `x-relay-api-version: 1` или path `/v1/...`, пока оба проекта не обновлены.

---

## 17) Как проекты общаются (сводка контракта)

**Входящий путь:**  
`Telegram` → Vercel `POST /api/telegram/webhook` → сразу `200` → async `POST` на backend `https://pocketmenu.ru/api/webhook-relay` с `x-relay-secret` и сырым `Update`.

**Исходящий путь:**  
Backend → `POST https://<relay>/api/telegram/send` с `x-relay-secret` и телом `{ method, payload }` → relay → `https://api.telegram.org/bot<TOKEN>/<method>`.

**Секреты:** одинаковый `RELAY_SHARED_SECRET` на Vercel и на backend. Токен бота хранить в relay (`TELEGRAM_BOT_TOKEN`); при нескольких ботах — whitelist методов и маппинг shop→token на стороне relay (не светить токены в логах).

Дублировать краткое описание контракта в обоих репо (`relay-contract.md` в корне или в `docs/`) — меньше рассинхрона.

---

## 18) Cursor: править relay и backend в одной сессии

Основной продукт — репозиторий `teleShop` (Nuxt). Прослойка — **отдельный** репозиторий. Чтобы агент/Composer видел **оба** дерева и мог менять файлы в одном запросе:

1. **File → Add Folder to Workspace…** — добавьте папку `teleShop` и папку `teleShop-telegram-relay`.
2. **File → Save Workspace As…** — сохраните, например `teleShop-all.code-workspace` (удобно хранить в `~/workspaces` или в одном из репо).

Альтернатива: открыть родительскую папку, в которой лежат оба клона (`~/projects/teleShop` и `~/projects/teleShop-telegram-relay`), но **multi-root workspace** обычно удобнее.

**Ограничения:** это два независимых git-репозитория — **коммиты и PR остаются два**. Агент может предложить правки в обоих; пуш/мердж — отдельно. Правила `.cursor/rules` действуют **по корню каждого репо**; при необходимости продублируйте короткое правило про синхронизацию контракта в обоих.

---

## 19) Промпт для Cursor: создать репозиторий прослойки (скопировать в чат)

Используйте в **multi-root workspace** (открыты и `teleShop`, и новая/пустая папка под relay), либо сначала создайте пустой репо и клонируйте её.

```text
Задача: создать минимальный репозиторий Vercel-прослойки для Telegram (отдельный проект, не Nuxt).

Стек: Node.js на Vercel Serverless (или Hono + @hono/node-server / hono/vercel — на твой выбор), без Next.js и без полного Nuxt.

Требования:

1) POST /api/telegram/webhook
   - Читает JSON body как сырой Telegram Update.
   - Если задан env TELEGRAM_WEBHOOK_SECRET — проверить заголовок X-Telegram-Bot-Api-Secret-Token.
   - Немедленно ответить 200 и телом { ok: true } (не ждать backend).
   - Асинхронно (fire-and-forget без блокировки ответа): POST на BACKEND_WEBHOOK_URL с тем же JSON телом, заголовки:
     Content-Type: application/json
     x-relay-secret: <RELAY_SHARED_SECRET>
     x-relay-source: vercel-telegram
   - При ошибке forward — только console.error, ответ клиенту уже отправлен.

2) POST /api/telegram/send
   - Требует заголовок x-relay-secret, совпадающий с RELAY_SHARED_SECRET, иначе 403.
   - Body JSON: { "method": string, "payload": object }
   - method whitelist: sendMessage, editMessageText, answerCallbackQuery, getChatMember (расширять только явно).
   - Вызов https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method} методом POST, body = JSON.stringify(payload).
   - Вернуть клиенту status и тело ответа Telegram (или ошибку).

3) GET /api/health — { ok: true, service: "telegram-relay" }

4) Файлы: package.json, vercel.json (или эквивалент для выбранного стека), .env.example со всеми переменными:
   TELEGRAM_BOT_TOKEN, BACKEND_WEBHOOK_URL, RELAY_SHARED_SECRET, TELEGRAM_WEBHOOK_SECRET (optional)

5) README: как задеплоить на Vercel, какие env выставить, как выставить webhook:
   setWebhook url -> https://<project>.vercel.app/api/telegram/webhook с secret_token.

6) Никаких секретов в репозитории; логи без полного токена.

После генерации кратко опиши структуру папок и команды npm run dev / deploy.
```

При работе **только** над relay откройте папку нового репозитория; для изменений и в `teleShop` (endpoint `/api/webhook-relay`, `TELEGRAM_TRANSPORT`) — используйте workspace с обоими папками и явно попросите: «обнови и relay, и backend в teleShop по контракту из docs/runbooks/TELEGRAM_VERCEL_RELAY_RUNBOOK_RU.md».

---

