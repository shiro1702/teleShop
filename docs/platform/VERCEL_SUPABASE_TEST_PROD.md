# Vercel + Supabase: тестовый стенд (staging) и production

## Цель
Настроить раздельные среды для:
- тестового стенда (`staging`) и
- продакшена (`production`)

чтобы не было пересечений данных и секретов, а Telegram Web App и Telegram webhook всегда ссылались на “правильный” backend URL.

## Рекомендуемая стратегия разнесения

### Vercel
Создайте **отдельные Vercel projects**:
- `tele-shop-staging`
- `tele-shop-production`

Почему так:
- для Telegram важен **стабильный** URL webhook и Web App URL (при переключениях сред вручную легко ошибиться);
- вы сможете независимо управлять env переменными и redeploy’ами.

Альтернатива: один Vercel project с “Environment Variables” под `preview/staging/production`. Она работает, но для webhook/webapp обычно больше ручных действий.

### Supabase
Создайте **отдельные Supabase projects** (или хотя бы отдельные базы/instances):
- `tele-shop-staging-db`
- `tele-shop-prod-db`

Почему:
- `SUPABASE_SERVICE_ROLE_KEY` должен быть строго server-only и не должен оказаться “подключенным” к неверной среде;
- даже если RLS изолирует данные, безопаснее разносить креденшелы.

## Что важно в текущем Nuxt проекте

В `nuxt.config.ts` Supabase и секреты берутся из env переменных:
- `runtimeConfig.botToken` <-- `NUXT_BOT_TOKEN`
- `runtimeConfig.managerChatId` <-- `NUXT_MANAGER_CHAT_ID`
- `runtimeConfig.appUrl` <-- `NUXT_APP_URL`
- `runtimeConfig.sessionSecret` <-- `NUXT_SESSION_SECRET`
- Supabase:
  - `runtimeConfig.supabaseUrl` <-- `SUPABASE_URL`
  - `runtimeConfig.supabaseServiceKey` (server-only) <-- `SUPABASE_SERVICE_ROLE_KEY`
  - `runtimeConfig.public.supabaseKey` <-- `SUPABASE_KEY` (это publishable/anon)

Также используется `NUXT_SESSION_SECRET` в:
- `server/api/auth/exchange-telegram-session.post.ts` (детерминированная синтетическая auth-пара для Telegram-link).

> В `.env.example` переменная `NUXT_SESSION_SECRET` не указана — добавьте её на Vercel самостоятельно (а при желании можно обновить и `.env.example`).

## Matrix env: что в `public`, что server-only

В `nuxt.config.ts` есть разделение:
- `runtimeConfig` (private / server-only по смыслу Nuxt)
- `runtimeConfig.public` (попадает в клиентский бандл и **может светиться в браузере**)

Практические выводы для Vercel:

1. Можно считать “безопасными для клиента” (public), потому что это не даёт доступ к управлению данными:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (anon/public)
   - `NUXT_PLATFORM_BASE_DOMAIN` (если используется)
   - `NUXT_DEFAULT_CITY_SLUG`
   - `NUXT_TELEGRAM_BOT_NAME`
   - `NUXT_PICKUP_POINTS_JSON` (если используется)
   - `NUXT_FULFILLMENT_TYPES`

2. Должно быть только Secret на Vercel (private / server-only):
   - `SUPABASE_SERVICE_ROLE_KEY` (используется через `serverSupabaseServiceRole` на сервере)
   - `NUXT_BOT_TOKEN`
   - `NUXT_MANAGER_CHAT_ID`
   - `NUXT_SESSION_SECRET`

3. Внимание: `DADATA_TOKEN`
   - В `nuxt.config.ts` он кладётся в `runtimeConfig.public.dadataToken`.
   - В `utils/dadataApi.ts` токен может читаться как `config.dadataToken || config.public?.dadataToken`.
   - Если `dadataSuggest()` вызывается из браузера, токен фактически окажется в клиенте.
   - Поэтому для `DADATA_TOKEN` рассматривайте подход:
     - либо не вызывать dadata на клиенте (вынос в server-only роут),
     - либо считать токен не “полным секретом” (минимизировать риски и ограничить ключ в Dadata, если это возможно).

## Пошагово: staging (тестовый стенд)

### 1) Supabase staging
1. Создайте Supabase project `tele-shop-staging-db`.
2. Примените схему БД:
   - по файлам в `supabase/migrations/` (в правильном порядке),
   - плюс (если используется текущая схема) SQL `supabase-telegram-link.sql`.
3. Подготовьте “первичные данные” для вашей витрины/бота:
   - минимум: `shops` (tenant/shop_id), `restaurants`, `restaurant_delivery_zones`, `products` и т.п.
   - значения должны соответствовать бизнес-логике и `shop_id`, который будет передаваться в checkout/order.
4. Заберите ключи:
   - `SUPABASE_URL` (Project Settings),
   - `SUPABASE_KEY` (обычно anon/public),
   - `SUPABASE_SERVICE_ROLE_KEY` (Service Role) — строго секрет.

### 2) Vercel staging
1. Создайте Vercel project `tele-shop-staging`.
2. Убедитесь, что build настроен под Nuxt:
   - `Install Command`: `npm ci` (или `npm install` если не используете lockfile),
   - `Build Command`: `npm run build`,
   - `Framework Preset`: Nuxt.js (если Vercel предлагает).
3. В Vercel откройте:
   - `Settings -> Environment Variables`
4. Добавьте env переменные для staging:
   - `NUXT_APP_URL` = публичный URL staging-приложения
     - пример: `https://tele-shop-staging-<hash>.vercel.app`
   - `SUPABASE_URL` = URL staging Supabase
   - `SUPABASE_KEY` = anon/public key staging Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key staging Supabase (должно быть Secret)
   - Telegram:
     - `NUXT_BOT_TOKEN` (fallback для бота/или ваш staging бот токен)
     - `NUXT_MANAGER_CHAT_ID`
   - Секрет сессии:
     - `NUXT_SESSION_SECRET` (любое сильное значение, желательно уникальное для staging)
   - Опционально:
     - `YANDEX_MAPS_API_KEY`, `YANDEX_GEOCODER_API_KEY`, `DADATA_TOKEN` (если используются)

5. Сделайте `Redeploy`.

### 3) Telegram: Web App и webhook для staging
1. В `BotFather` настройте **Web App URL** своего Telegram бота:
   - `https://<staging-vercel-domain>/` (значение должно совпадать с `NUXT_APP_URL`)
2. Подключите webhook на backend URL staging:
   - `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<staging-vercel-domain>/api/webhook`
3. После этого все апдейты Telegram и открытие Web App будут попадать в staging.

Подсказка:
- общий чек-лист по этому процессу есть в `TELEGRAM_TESTING.md`;
- webhook endpoint в проекте — это `server/api/webhook.post.ts` (т.е. HTTP путь вида `/api/webhook`).

## Пошагово: production

Производственная среда делается **симметрично** staging:
1. Supabase:
   - создайте отдельный Supabase project
   - примените `supabase/migrations/` и `supabase-telegram-link.sql`
   - заполните `shops/restaurants/products/...` для production (или синхронизируйте с staging через вашу процедуру импорта).
2. Vercel:
   - создайте `tele-shop-production`
   - задайте `NUXT_APP_URL` как production URL
   - выставьте production `SUPABASE_URL/SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY`
   - выставьте production `NUXT_BOT_TOKEN/NUXT_MANAGER_CHAT_ID`
   - выставьте `NUXT_SESSION_SECRET` (желательно уникальный)
3. Telegram:
   - Web App URL указывает на production `NUXT_APP_URL`
   - webhook установлен на `https://<production-domain>/api/webhook`

## Обязательные различия между staging и production
Разносите как минимум:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NUXT_APP_URL`
- `NUXT_SESSION_SECRET`
- и желательно `NUXT_BOT_TOKEN` (отдельный бота для staging, иначе webhook придется переключать вручную).

## Что отслеживать после деплоя (quick verification)

### staging checklist
1. Открывается витрина в браузере и маршруты checkout работают.
2. В Telegram при нажатии “Открыть магазин” открывается **staging** URL.
3. Нажатие менеджера (inline-кнопки) приходит в webhook staging и корректно меняет состояние.
4. Заказы создаются и записи появляются в **staging Supabase**.

### production checklist
То же самое, но в prod.

## Продвижение изменений (promotion)
1. Сначала выкатывайте код в staging и проверяйте поведение.
2. Затем применяйте миграции в production (в том же порядке).
3. Обновите env/ключи только если изменились.
4. Деплой production по вашему обычному workflow (merge в `main`, релиз и т.п.).

## Ссылки на внутренние документы
- `TELEGRAM_TESTING.md` (Web App и webhook на Vercel)
- `ORDER_SYSTEM.md` (эндпоинты `/api/order` и `/api/webhook`)
- `README.md` (перечень env переменных и общий деплой-опис)
