## Обзор текущего флоу заказа и авторизации (обновлено)

Документ фиксирует уже внедренное состояние multi-tenant флоу:
- tenant-контекст (`shop_id`) во всех ключевых API;
- оформление заказа через `pages/checkout.vue` (без `CartModal.vue`);
- Telegram как основной канал идентификации в TMA и канал уведомлений в вебе;
- привязка пользователей через Supabase `profiles.telegram_id`.

---

### 1. Флоу заказа (факт)

#### 1.1. Telegram Mini App (WebApp внутри Telegram)

- Пользователь открывает Mini App через кнопку «Открыть магазин» в боте.
- Внутри TMA:
  - `useTelegram()` даёт `webApp.initData`.
  - Оформление идёт через `checkout.vue`, где в body передаются:
    - `shopId`,
    - `restaurantId`,
    - `items`,
    - `address/pickup` и `fulfillmentType`,
    - `initData`.
- На сервере (`server/api/order.post.ts`):
  - берётся tenant-контекст из `event.context.tenant`;
  - валидируется `shop_id` из payload;
  - товарные позиции пересчитываются по Supabase `products` текущего магазина;
  - ресторан и зона доставки валидируются по `restaurants`/`restaurant_delivery_zones`;
  - пользователь определяется по `initData` (TMA) или Supabase + `profiles.telegram_id` (Web).
- Бэкенд отправляет:
  - сообщение менеджеру с деталями заказа и inline‑кнопками статусов;
  - отдельное уведомление клиенту в Telegram о принятии заказа;
  - возвращает `{ ok: true, orderId }`.

**Вывод:** флоу заказа через TMA полностью автономный, использует только Telegram‑идентификацию и **не зависит от Supabase**.

#### 1.2. Веб‑сайт (браузер)

- Пользователь добавляет товары в корзину на сайте и оформляет через `checkout.vue`.
- Для веб-заказа сервер требует Supabase-пользователя и `profiles.telegram_id`.
- Если Telegram не привязан, API возвращает `409`, фронт отправляет пользователя в link-flow.

**Важно:** legacy-механизм через `tg_session` для `/api/order` устранён; основной веб-флоу опирается на Supabase + `profiles.telegram_id`.

---

### 2. Флоу привязки через Telegram

Цель: использовать Telegram как **основной логин** и привязать `telegram_id` к пользователю Supabase, без предварительного входа на сайте.

#### 2.1. Таблицы в Supabase

- `public.profiles`:
  - связь `id` → `auth.users(id)` (PK, FK);
  - `telegram_id bigint unique`;
  - RLS: `auth.uid() = id` для всех операций.
- `public.auth_tokens`:
  - `token uuid primary key default gen_random_uuid()`;
  - `telegram_id bigint not null`;
  - `created_at`, `expires_at` (+15 минут);
  - RLS: доступ только для `service_role` (политика `"Service role can manage auth tokens"`).

#### 2.2. Генерация токена в боте

В `server/api/webhook.post.ts`:

- Команда `/login`:
  - через `serverSupabaseServiceRole` вставляет запись в `auth_tokens { token, telegram_id: chatId }`;
  - строит ссылку `appUrl/link-telegram?token=...`;
  - отправляет пользователю сообщение с кнопкой «Привязать Telegram».

- `/start auth_link` (переход с сайта `https://t.me/<bot>?start=auth_link`):
  - аналогично создаёт токен;
  - строит ссылку `appUrl/link-telegram?token=...&redirect=/<city_slug>/<tenant_slug>/cart`;
  - отправляет кнопку «Привязать Telegram и вернуться на сайт».

#### 2.3. Страница `link-telegram.vue`

- Получает `token` и опциональный `redirect` из query.
- Показывает одну кнопку «Привязать Telegram».
- При клике:
  - вызывает `POST /api/auth/link-telegram` с `{ token }`;
  - при успехе:
    - помечает `isSuccess = true`;
    - редиректит в каноничную tenant корзину (`/:city_slug/:tenant_slug/cart`).

#### 2.3.1. Legacy маршрут checkout удален

- Маршрут вида `/checkout?shop_id=...` больше не является рабочим storefront-путем.
- Для таких запросов используется серверный редирект в каноничную tenant корзину или 404 при невозможности резолва.

#### 2.4. `/api/auth/link-telegram` — Telegram как основной логин

Файл `server/api/auth/link-telegram.post.ts`:

- Проверяет токен в `auth_tokens`, срок действия и берёт `telegram_id`.
- Пытается найти профиль по `telegram_id`:
  - если **есть**:
    - возвращает `{ success: true, telegramId, userId: profile.id }`;
  - если **нет**:
    - через `service_role` создаёт новую запись в `auth.users`:
      - `email = tg_<telegram_id>@telegram.local`;
      - случайный пароль;
      - `user_metadata.telegram_id = telegram_id`;
    - создаёт/обновляет профиль в `profiles` (`id = user.id`, `telegram_id`).
    - возвращает `{ success: true, telegramId, userId }`.
- Токен в `auth_tokens` удаляется.

**Сильная сторона:** Telegram действительно становится **источником учётной записи** в Supabase — не нужен предварительный логин через сайт.

**Слабое место:** после создания пользователя в `auth.users` **не создаётся Supabase‑сессия** (нет JWT/куки). Веб‑клиент не аутентифицирован как этот пользователь, поэтому:
- `useSupabaseUser()` на фронте по-прежнему даёт `null`;
- существующие флоу, которые завязаны на Supabase‑сессию (если появятся), не будут работать «из коробки».

---

### 3. Оставшиеся риски и задачи

#### 3.1. Синхронизация bridge и tenant-resolve

- Для `GET /api/cart-bridge` tenant-контекст не всегда доступен на middleware-слое, так как `shop_id` может быть только внутри bridge token.
- Сейчас это обработано отдельным bypass в middleware для `GET /api/cart-bridge`.

**Следствие:** важно не убирать этот bypass, пока извлечение tenant из token не перенесено в middleware.

**Рекомендация:** перенести извлечение `shop_id` из bridge token в общее место tenant-resolve.

#### 3.2. Каталог в checkout/cart-store

- Сервер уже использует Supabase `products` по tenant.
- Нужно убедиться, что во всех клиентских сценариях каталог и корзина инициализированы tenant-данными до checkout.

#### 3.3. Документация и техдолг

- Удалены runtime-зависимости от `CartModal.vue`, но часть markdown-документов ещё может содержать исторические ссылки.
- Рекомендуется поддерживать документы как "current architecture", а старые описания выносить в archive.

### 4. Целевой следующий шаг

1. Довести restaurant-specific зоны до полного паритета во всех сценариях (включая edge-cases адресов).
2. Вынести tenant/restaurant contracts в единые типы для client+server.
3. Обновить оставшуюся техдокументацию под multi-tenant модель без legacy-описаний.

