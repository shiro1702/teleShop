# teleShop — Telegram Mini App + бот (Nuxt 3)

Пет‑проект интернет‑магазина, который работает как **Telegram Bot + Telegram Mini App (WebApp)**: витрина, корзина, оформление заказа и отправка заказа менеджеру.

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
  - `NUXT_BOT_TOKEN` — токен бота от `@BotFather`
  - `NUXT_TELEGRAM_BOT_NAME` — username бота (без `@`)
  - `NUXT_MANAGER_CHAT_ID` — chat id менеджера, куда прилетают заказы
  - `NUXT_APP_URL` — публичный HTTPS URL WebApp (например Vercel), который бот отдаёт кнопкой
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

