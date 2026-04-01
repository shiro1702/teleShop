# PocketMenu (pocketmenu.ru) — меню в вашем кармане (Nuxt 3)

SaaS-платформа интернет-магазинов на одной кодовой базе: **Telegram Bot + Telegram Mini App + Web checkout**.
Данные изолируются по `shop_id` (tenant), каталог и рестораны хранятся в Supabase.

## Превью

- **Web (Vercel)**: `https://tele-shop-sigma.vercel.app/`

## Telegram

- **Бот**: `https://t.me/arsTeleShopBot` (ник: `@arsTeleShopBot`)
- **Mini App**: открывается внутри бота по кнопке “Открыть магазин” (WebApp URL указывается в `NUXT_APP_URL`)

## Стек

- **Nuxt 3 / Vue 3**
- **Pinia**
- **TailwindCSS**
- **Supabase** (интеграция через `@nuxtjs/supabase`)
- **Telegram Web Apps JS SDK** (`https://telegram.org/js/telegram-web-app.js`)

## Текущая архитектура (кратко)

- Multi-tenant контекст определяется через `shop_id` и `server/middleware/tenant.ts`.
- Каталог, рестораны и зоны доставки читаются из Supabase:
  - `products` (по `shop_id`)
  - `restaurants` (по `shop_id`)
  - `restaurant_delivery_zones` (по `shop_id + restaurant_id`)
- Оформление заказа:
  - клиент отправляет `shopId`, `restaurantId`, `items`, `fulfillmentType`, адрес/зону;
  - сервер пересчитывает сумму только по Supabase-данным текущего tenant.
- Telegram уведомления:
  - токен бота и чат менеджера берутся из tenant-конфига (`shops`, `integration_keys`) с fallback на env.

## Быстрый старт (локально)

### Требования

- Node.js (рекомендовано **18+**)
- npm

### Установка и запуск

```bash
npm install
cp .env.example .env
npm run dev
```

Приложение поднимется на `http://localhost:3000`.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения.

- **Telegram**
  - `NUXT_BOT_TOKEN` — fallback токен бота от `@BotFather` (если у магазина не задан свой)
  - `NUXT_TELEGRAM_BOT_NAME` — username бота (без `@`)
  - `NUXT_MANAGER_CHAT_ID` — fallback chat id менеджера
  - `NUXT_APP_URL` — публичный HTTPS URL WebApp (например Vercel), который бот отдаёт кнопкой
- **Legacy fallback (опционально)**
  - `NUXT_PICKUP_POINTS_JSON` — резервные точки самовывоза, если restaurants API пуст
  - `NUXT_FULFILLMENT_TYPES` — резервные способы получения
- **Карты/геокодинг (если используется в чекауте)**
  - `YANDEX_MAPS_API_KEY`
  - `YANDEX_GEOCODER_API_KEY`
  - `DADATA_TOKEN`
- **Supabase**
  - `SUPABASE_URL`
  - `SUPABASE_KEY` — публичный ключ (anon/publishable)
  - `SUPABASE_SERVICE_ROLE_KEY` — **только серверный** ключ (не должен попадать в клиент)

## Скрипты

```bash
npm run dev       # dev server
npm run build     # production build
npm run preview   # preview production build
npm run generate  # static generation (если применимо)
```

## Деплой

Проект удобно деплоить на Vercel. После деплоя:

- установите `NUXT_APP_URL` равным публичному HTTPS адресу (например `https://tele-shop-sigma.vercel.app/`)
- убедитесь, что в Telegram Bot настройках WebApp указан тот же домен/URL (при необходимости)
- подготовьте Supabase таблицы и миграции из `supabase/migrations`
- добавьте записи в `shops`, `restaurants`, `restaurant_delivery_zones`, `products` с корректным `shop_id`

## Документация по платежам

- `docs/PAYMENTS_RU_YOOKASSA_TBANK.md` - архитектура платежей YooKassa/Т-Банк, B2C/B2B контуры, webhook-процессы.
- `docs/SAAS_BILLING_RU.md` - модель SaaS-подписки платформы: продления, grace period, upgrade/downgrade.
- `docs/MULTI_TENANT_SAAS.md` (раздел `14.2`) - краткая привязка платежной модели к общей мультитенантной архитектуре.

