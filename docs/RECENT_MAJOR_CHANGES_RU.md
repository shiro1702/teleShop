# Кардинальные изменения по коммитам (апрель 2026)

Краткое описание существенных доработок. Хэши приведены для трассировки в `git`.

---

## `8be33fd1c4c9ba110f84762950a02101d7577669` — привязка чата к Telegram

**Дата:** 2026-04-09

**Суть:** магазин может **привязать свой Telegram-чат** (группа/супергруппа или личный чат менеджера) к tenant, чтобы уведомления о заказах и управление шли в нужный чат, а не только в fallback из env.

**Что появилось:**

- Миграция `026_telegram_chat_link_tokens.sql` — хранение одноразовых/служебных токенов привязки.
- Серверный маршрут `POST /api/dashboard/integrations/telegram-chat-link-token` — выдача токена для сценария привязки из дашборда.
- Существенное расширение `server/api/webhook.post.ts` — обработка шагов привязки чата через бота.
- UI на `pages/dashboard/integrations.vue` — блок настройки привязки чата.

---

## `bff041524736fa42aaa834095d209bd0d9ef9edc` — сообщения и кнопки в Telegram

**Дата:** 2026-04-09

**Суть:** доработаны **исходящие уведомления** и **интерактив в Telegram** (тексты, кнопки), плюс возможность **отвязать** чат.

**Что появилось:**

- `POST /api/dashboard/integrations/telegram-chat-unlink` — отвязка привязанного чата.
- Расширение `server/utils/notifications.ts` — единая логика сообщений для разных сценариев.
- Дополнения в `webhook.post.ts` и в `integrations.vue` под новые сценарии.

---

## `7fb48ba7f42c9a17a9dd741a392a663d067c3f62` — фиксы и адреса доставки клиента

**Дата:** 2026-04-11

**Суть:** **сохранённые адреса доставки** для авторизованного клиента (CRUD на сервере + использование в чекауте), плюс сопутствующие правки профиля, бонусов и API.

**Что появилось:**

- Миграция `027_customer_delivery_addresses.sql`.
- API: `GET/POST /api/customer/addresses`, `DELETE /api/customer/addresses/[id]`.
- Утилита `server/utils/customerProfile.ts` и доработки `composables/useCheckoutAddress.ts`.
- Правки страниц `checkout`, `profile`, `bonuses`, заголовка `AppHeader`, обновление заказа/loyalty/YooKassa там, где это связано с профилем и адресами.

---

## `2d742784dd4a564ced9ae8821b9e550ec1a5a3ec` — настройки организации и витрина

**Дата:** 2026-04-11

**Суть:** **переработка настроек организации** в дашборде (в т.ч. стиль и режимы работы), согласование с публичными API ресторанов/магазинов и городской витриной; правки главной и страницы города.

**Что изменилось:**

- `pages/dashboard/settings/organization.vue` — заметный рефакторинг форм и логики.
- Сервер: `organization/style/operations.put.ts`, доработки `contacts.put`, `organizationStyle.ts`, `platformOperationSettings.ts`, `restaurants.get`, `shops.get`, `restaurants` (публичный контур).
- Страницы `pages/index.vue`, `pages/[city_slug]/index.vue`, филиал `dashboard/branches/[id]/index.vue` и `kitchen.vue` — в связке с новыми настройками.
- Правило Cursor: добавлено `dashboard-api-toasts.mdc`, удалено `nuxt-runtime-restart-check.mdc`; обновлён `.env.example`.

---

## `95da4bedc70a16724b521dfa8e4e2a4171414ab3` — режим работы ресторанов и карта самовывоза

**Дата:** 2026-04-11

**Суть:** учёт **настроек работы точек** при выдаче списков ресторанов/магазинов и на витрине; **карта OpenStreetMap** с кластеризацией для поиска точки самовывоза; серверный **геокодинг** для координат.

**Что появилось:**

- Компонент `components/maps/OsmClusterMap.vue`, composable `composables/useGeocodedMarkers.ts`.
- `GET /api/geocode` — геокодирование адресов на сервере.
- Зависимости для карты (см. `package.json` / `package-lock.json`).
- Доработки `pages/[city_slug]/index.vue`, `index.vue`, `checkout.vue`, `shops.get`, `restaurants.get`, `order.post` и др. в связи с геоданными и фильтрацией по работе точек.

---

## Связанные артефакты

- Интеграции (дашборд): `pages/dashboard/integrations.md`
- Правило UX для ошибок API в дашборде: `.cursor/rules/dashboard-api-toasts.mdc`
