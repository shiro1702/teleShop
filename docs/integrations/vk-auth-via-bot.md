# VK ID OAuth для авторизации на сайте (по паттерну Telegram/MAX)

Документ описывает, как внедрён вход через VK ID в текущую архитектуру teleShop без изобретения новой схемы.
Ориентиром служит уже рабочий flow для Telegram/MAX:

- генерация токена: `server/api/auth/request-telegram-link.post.ts`, `server/api/auth/request-max-link.post.ts`;
- webhook-подтверждение токена: `server/api/webhook.post.ts`, `server/api/webhook-max.post.ts`;
- polling статуса: `server/api/auth/telegram-link-status.get.ts`, `server/api/auth/max-link-status.get.ts`;
- обмен токена на Supabase-сессию: `server/api/auth/exchange-telegram-session.post.ts`, `server/api/auth/exchange-max-session.post.ts`;
- клиентский экран завершения входа: `pages/link-telegram.vue`, `pages/link-max.vue`;
- старт входа из UI: `components/AppHeader.vue`.

Ниже blueprint, привязанный к реальному коду проекта, плюс пометки о фактически выполненной работе.

## Статус реализации

### Уже сделано в коде

- Добавлена миграция `supabase/migrations/045_vk_oauth.sql`:
  - `auth_tokens`: `vk_user_id`, `vk_state`, `vk_code_verifier`, `vk_device_id`
  - `profiles`: `vk_user_id`, `vk_email`, `vk_phone`
  - unique partial индексы на `auth_tokens.vk_state` и `profiles.vk_user_id`
- Добавлен runtime/env конфиг VK ID:
  - `nuxt.config.ts`: `vkIdClientSecret`, `vkIdRedirectUri`, `vkIdBaseUrl`, `public.vkIdClientId`
  - `.env.example`: `NUXT_VK_ID_CLIENT_ID`, `NUXT_PUBLIC_VK_ID_CLIENT_ID`, `NUXT_VK_ID_CLIENT_SECRET`, `NUXT_VK_ID_REDIRECT_URI`, `NUXT_VK_ID_BASE_URL`
- Реализован helper OAuth PKCE: `server/utils/vkOAuth.ts`
- Расширен helper линков: `server/utils/authSiteLink.ts` (`link-vk`)
- Реализованы API для VK:
  - `server/api/auth/request-vk-link.post.ts`
  - `server/api/auth/vk-id/callback.get.ts`
  - `server/api/auth/vk-link-status.get.ts`
  - `server/api/auth/exchange-vk-session.post.ts`
- Добавлена страница завершения входа: `pages/link-vk.vue`
- Обновлён UI входа: `components/AppHeader.vue` (кнопка "Войти через VK", `openVkAuth`, маршрут `/link-vk` в non-tenant)
- Прогнан `npm run build` после изменений (успешно).

### Что осталось для запуска в production

- Создать/настроить VK ID приложение в кабинете VK.
- Заполнить production env:
  - `NUXT_VK_ID_CLIENT_ID`
  - `NUXT_VK_ID_CLIENT_SECRET`
  - `NUXT_VK_ID_REDIRECT_URI` (должен совпадать с настройкой в VK ID)
  - при необходимости `NUXT_VK_ID_BASE_URL`
- Проверить E2E на prod-домене: `request-vk-link -> callback -> link-vk -> exchange-vk-session -> redirect`.

## 1) Цель и ожидаемый UX

- Пользователь на сайте жмет "Войти через VK".
- Сайт выдает одноразовый токен и `authorizeUrl` VK ID (OAuth 2.1 + PKCE).
- Пользователь подтверждает вход в VK ID.
- Callback (`/api/auth/vk-id/callback`) сохраняет `vk_user_id` в `auth_tokens`.
- Страница `link-vk` завершает вход (через `exchange-vk-session`) и редиректит в нужный `redirect`.

## 2) Что нужно в VK заранее

1. Создать/подключить VK ID приложение.
2. Настроить redirect URI в кабинете VK ID:
   - `https://<app-domain>/api/auth/vk-id/callback`
3. Получить `client_id` и `client_secret`.
4. Разрешить нужные scope (минимум: `email phone vkid.personal_info`).

## 3) Переменные окружения

Используются переменные:

- `NUXT_VK_ID_CLIENT_ID` — VK ID app id (fallback для public)
- `NUXT_PUBLIC_VK_ID_CLIENT_ID` — публичный app id для фронта
- `NUXT_VK_ID_CLIENT_SECRET` — серверный секрет VK ID
- `NUXT_VK_ID_REDIRECT_URI` — callback URI
- `NUXT_VK_ID_BASE_URL` — по умолчанию `https://id.vk.com`
- `NUXT_APP_URL` — базовый URL сайта (уже используется в helper сборки ссылок)

По аналогии с текущими переменными:
- Telegram: `public.telegramBotName`;
- MAX: `public.maxBotUrl`, `maxApiBaseUrl`, `maxApiToken`;
- VK реализован как VK ID OAuth, не через bot URL.

## 4) Данные и миграции

Используем существующую таблицу `auth_tokens`, как и для `telegram`/`max`.

### 4.1. Расширить `auth_tokens`

Текущее состояние БД:
- в `auth_tokens` уже есть `channel`, `max_user_id`, `max_conversation_id` (миграция `024_auth_tokens_channels.sql`);
- `telegram_id` уже nullable для pending-токенов (миграция `028_auth_tokens_telegram_id_nullable.sql`);
- в `profiles` уже есть `max_user_id`, `max_conversation_id` (миграция `023_omnichannel_notifications.sql`).

Для VK добавить поля:

- `channel text` — уже используется в проекте (`telegram`, `max`), добавить значение `vk`.
- `vk_user_id text null` — ID пользователя VK, подтвердившего токен.
- `vk_conversation_id text null` — опционально: peer/conversation id для ответов и аудита.

Пример миграции:

```sql
alter table public.auth_tokens
  add column if not exists vk_user_id text,
  add column if not exists vk_conversation_id text;

alter table public.profiles
  add column if not exists vk_user_id text,
  add column if not exists vk_conversation_id text;

create index if not exists idx_auth_tokens_channel_expires
  on public.auth_tokens (channel, expires_at desc);

create unique index if not exists idx_profiles_vk_user_id_unique
  on public.profiles (vk_user_id)
  where vk_user_id is not null;
```

Важно: не хранить `vk_user_id` на фронте как источник истины. Источник — только webhook + сервисный ключ.

## 5) Серверные эндпоинты (по аналогии с Telegram/MAX)

Ниже не абстракция, а прямой mapping текущих файлов на VK-вариант.

## 5.1 `POST /api/auth/request-vk-link`

Задача:
- принять `shopId`, `citySlug`, `redirectPath`, `bridgeKey` (как в `request-telegram-link` / `request-max-link`);
- создать `token = uuid`;
- вставить в `auth_tokens`:
  - `token`,
  - `channel = 'vk'`,
  - `vk_user_id = null`,
  - `bridge_payload` с `link_context`.
- вернуть:
  - `token`,
  - `botStartParam = link_<uuid>`.

Базироваться на коде:
- `server/api/auth/request-telegram-link.post.ts`
- `server/api/auth/request-max-link.post.ts`

Контракт запроса (тот же, что сейчас):
```json
{
  "shopId": "uuid-or-slug",
  "citySlug": "ulan-ude",
  "redirectPath": "/<city>/<tenant>/checkout?step=1",
  "bridgeKey": "optional"
}
```

Контракт ответа:
```json
{
  "ok": true,
  "token": "uuid",
  "botStartParam": "link_<uuid>"
}
```

Технические детали, которые нужно повторить один в один:
- `sanitizeInternalPath()` (защита от внешних redirect);
- merge `bridge_payload` из `auth_bridge_sessions` + удаление bridge row после использования;
- запись `bridge_payload.link_context` c:
  - `shop_slug`
  - `city_slug`
  - `redirect_path`
  - `custom_domain_hostname`
- `channel` строго `'vk'`.

## 5.2 `GET /api/auth/vk-id/callback`

Задача:
- принять `code`, `state`, `device_id`, `error` из query;
- найти токен в `auth_tokens` по `vk_state`;
- проверить `channel='vk'` и TTL;
- обменять `code` на токены через `/oauth2/auth`;
- получить профиль пользователя через `/oauth2/user_info`;
- записать `vk_user_id` и данные в `bridge_payload`;
- сделать redirect на `link-vk`.

Правила:
- если токен просрочен -> удалить токен, отправить пользователю сообщение "Ссылка истекла".
- если у токена уже стоит другой `vk_user_id` -> отклонить (защита от повторного использования).
- если пусто -> записать `vk_user_id` (и при желании `vk_conversation_id`).

Базироваться на:
- `server/utils/vkOAuth.ts`
- `server/utils/authSiteLink.ts`
- `server/api/auth/vk-id/callback.get.ts`

Ключевые требования реализации:
- проверка `state` через `auth_tokens.vk_state`;
- защита от гонок при записи `vk_user_id` (conditional update);
- безопасный redirect на `link-vk` через `buildAuthSiteLinkUrl(...)`.

После подтверждения:
- собрать ссылку завершения входа через `buildAuthSiteLinkUrl(...)`.

Важно: сейчас helper типизирован только под `link-telegram | link-max`:
```ts
linkPath: 'link-telegram' | 'link-max'
```
Для VK нужно расширить union до:
```ts
linkPath: 'link-telegram' | 'link-max' | 'link-vk'
```

Пользователь после VK consent сразу редиректится на `link-vk`.

## 5.3 `GET /api/auth/vk-link-status`

Нужен для polling на странице `link-vk`.

Ответы:
- `pending` — токен есть, но `vk_user_id` еще не заполнен;
- `ready` — `vk_user_id` уже записан;
- `expired` — токен просрочен;
- `invalid` — токен не найден/не VK.

Скопировать логику из:
- `server/api/auth/telegram-link-status.get.ts`
- `server/api/auth/max-link-status.get.ts`

Нюансы:
- при `expired` сразу удалять токен (как в текущих status роутингах);
- не бросать ошибку на `invalid`, а возвращать `{ ok: true, state: 'invalid' }`.

## 5.4 `POST /api/auth/exchange-vk-session`

Задача:
- принять `token`;
- проверить токен (`channel='vk'`, не истек, есть `vk_user_id`);
- найти профиль по `profiles.vk_user_id`;
- если не найден — создать пользователя в Supabase Auth и `profiles`;
- удалить использованный токен;
- вернуть `access_token`, `refresh_token`, `expires_in`, `bridge_payload`.

Базироваться на:
- `server/api/auth/exchange-telegram-session.post.ts`
- `server/api/auth/exchange-max-session.post.ts`

Рекомендуемый контракт ответа (как в текущих exchange):
```json
{
  "success": true,
  "userId": "uuid",
  "vkUserId": "string",
  "bridge_payload": {},
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

Синтетические креды для signInWithPassword (по аналогии):
- email: `vk_<normalized_vk_user_id>@vk.local`
- password: `sha256(vk_user_id + ":" + sessionSecret)`

Обязательные проверки до exchange:
- токен существует;
- `channel='vk'`;
- не истек;
- `vk_user_id` уже заполнен (иначе 409 `"VK confirmation pending"`).

## 6) Фронтенд

## 6.1 Страница `pages/link-vk.vue`

По структуре копирует `pages/link-telegram.vue`/`pages/link-max.vue`:

- берет из query: `token`, `redirect`, `shop_id`;
- показывает кнопку "Открыть VK и подтвердить вход";
- стартует polling `GET /api/auth/vk-link-status`;
- при `ready` вызывает `POST /api/auth/exchange-vk-session`;
- устанавливает Supabase-сессию (`supabase.auth.setSession(...)`);
- мерджит `bridge_payload` в store;
- редиректит на canonical checkout/redirect.

Точки, которые не пропустить:
- использовать тот же polling цикл: 150 попыток, интервал 2 секунды;
- статусные тексты и ошибки формировать как в `link-telegram.vue` (через `err.data.statusMessage`);
- после `exchange` выполнять:
  - `supabase.auth.setSession(...)`
  - `cartStore.mergeBridgePayload(...)`
  - `router.replace(await resolveAfterLogin())`
- добавить `/link-vk` в список non-tenant route в `components/AppHeader.vue` (рядом с `/link-telegram`, `/link-max`).

## 6.2 Кнопка входа в интерфейсе

В месте выбора канала авторизации:
- вызвать `POST /api/auth/request-vk-link`;
- собрать ссылку на бота: `NUXT_PUBLIC_VK_BOT_URL + start/ref=link_<uuid>`;
- перевести пользователя на `link-vk?token=...` (или открыть VK в новой вкладке и оставить polling-экран активным).

Фактическая точка в коде: `components/AppHeader.vue`, методы `openTelegramAuth()` и `openMaxAuth()`.

Что добавить:
- `vkBotUrl` computed из `config.public.vkBotUrl`;
- кнопку `Войти через VK` в модалке выбора способа входа;
- метод `openVkAuth()` по шаблону существующих методов:
  1) вызвать `/api/auth/request-vk-link`;
  2) открыть VK URL в новой вкладке;
  3) перейти на `/link-vk` с query `token`, `redirect`, `shop_id`.

## 7) Безопасность

- TTL токена: 10-15 минут.
- Токен одноразовый: удалять после успешного exchange.
- Любые операции с `auth_tokens` и `profiles` только через `service_role`.
- Проверять `channel='vk'` на всех стадиях.
- Не доверять `vk_user_id` из клиента: только из webhook.
- Логировать попытки с невалидным/чужим токеном.
- На webhook возвращать 2xx даже при внутренних ошибках, если VK агрессивно ретраит (в Telegram это уже учтено в `server/api/webhook.post.ts`).

## 8) Пошаговый план реализации в коде

1. **Миграция БД**
   - добавить `vk_user_id`, `vk_conversation_id` в `auth_tokens`;
   - добавить `vk_user_id`, `vk_conversation_id` в `profiles`;
   - индекс/уникальность для `profiles.vk_user_id`.

2. **Сервер auth API**
   - `server/api/auth/request-vk-link.post.ts`
   - `server/api/auth/vk-link-status.get.ts`
   - `server/api/auth/exchange-vk-session.post.ts`

3. **Webhook VK**
   - `server/api/webhook-vk.post.ts`
   - парсинг start payload `link_<uuid>`
   - update `auth_tokens.vk_user_id`
   - отправка ссылки на `link-vk`

4. **Общий helper**
   - расширить `buildAuthSiteLinkUrl` под `link-vk`.

5. **Frontend**
   - создать `pages/link-vk.vue` (копия `link-max.vue` с VK API роутами);
   - обновить `components/AppHeader.vue` (кнопка + `openVkAuth` + non-tenant route).

6. **Smoke/E2E**
   - ручной сценарий: request -> VK confirm -> status ready -> exchange -> redirect;
   - проверить ветки `invalid`, `expired`, `pending`.

## 9) Минимальный чек-лист запуска

1. Миграция `auth_tokens` под `vk_user_id`.
2. Реализованы роуты:
   - `/api/auth/request-vk-link`
   - `/api/auth/vk-id/callback`
   - `/api/auth/vk-link-status`
   - `/api/auth/exchange-vk-session`
3. Создана `pages/link-vk.vue`.
4. Добавлена кнопка "Войти через VK" на сайте.
5. Настроены env (`NUXT_VK_ID_CLIENT_ID`, `NUXT_VK_ID_CLIENT_SECRET`, `NUXT_VK_ID_REDIRECT_URI`, `NUXT_PUBLIC_VK_ID_CLIENT_ID`).
6. Redirect URI в VK ID указывает на прод-URL `/api/auth/vk-id/callback`.
7. Пройден E2E сценарий:
   - запрос токена на сайте,
   - подтверждение в VK,
   - успешный обмен на Supabase-сессию,
   - редирект в checkout.
8. Проверена обратная совместимость Telegram/MAX (регрессий нет).

## 10) Рекомендуемый порядок внедрения

1. Сначала сделать backend flow и webhook (без UI полировки).
2. Затем `link-vk` страницу с polling.
3. Затем кнопку входа в UI и обработку ошибок.
4. После стабилизации добавить отладочные логи и алерты по `invalid/expired` токенам.

Так риск ниже: сначала проверяется серверная часть и валидность webhook, затем подключается UI.
