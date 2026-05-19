# Документация teleShop / PocketMenu

**Быстрая карта папок и правила «куда класть новое»:** [STRUCTURE.md](STRUCTURE.md).

Краткая карта каталога `docs/`. Цель разбиения: отделить **канонические справочники** и **платформенную архитектуру** от **черновиков и маркетинга**, а **бэклог планов** — от **описаний фич** и **runbook’ов**.

## Куда класть новые файлы

| Тип материала | Папка | Примечание |
|---------------|--------|------------|
| Глоссарий, хронология крупных релизов | `reference/` | Редко меняется; на него ссылаются из кода и `.planning/`. |
| Мультитенант, омниканал, биллинг платформы, окружения | `platform/` | Продуктовая и инфраструктурная «опора» платформы. |
| RFC / продукт+тех по конкретной фиче витрины или compliance | `features/` | Может описывать и будущее состояние; статус лучше помечать в тексте или в `reference/RECENT_MAJOR_CHANGES_RU.md` после выката. |
| Эквайринг, платежи заказов, долги по платежам | `payments/` | Связано с `platform/SAAS_BILLING_RU.md`, но ближе к платёжным провайдерам. |
| Планы работ, оптимизации, ещё не сделанное | `backlog/` | Именованные планы (раньше `TODO/`). |
| Деплой, серверы, реле Telegram, self-hosted | `runbooks/` | Пошаговые инструкции для операций. |
| Внешние системы, контракты API, планы интеграций | `integrations/` | В т.ч. `QUICK_RESTO_INTEGRATION_PLAN_RU.md`. |
| Вертикаль «фестиваль» | `verticals/festival/` | Всё, что относится к фестивальному сценарию. |
| Идеи, стратегия, сценарии рилсов, неформальные заметки | `content/brainstorm/` | Не считать источником правды для реализации без переноса в `features/` или `platform/`. |
| Карусели, публичные тезисы | `content/instagram-carousels/` | Маркетинговый контент. |
| Структура лендингов для партнёров | `marketing/` | A/B варианты оглавления и блоков. |
| Методологии (GSD, UI-скилл) | `meta/` | Процесс и качество, не продукт. |

## Содержимое по разделам

### `reference/`

- `TERMS.md` — термины домена (`shop`, `restaurant`, маршруты).
- `RECENT_MAJOR_CHANGES_RU.md` — крупные изменения с привязкой к коммитам (дополнять после значимых релизов).

### `platform/`

- `MULTI_TENANT_SAAS.md` — мультитенантность, города, политики.
- `SAAS_BILLING_RU.md` — подписка платформы (B2B).
- `FEATURE_TOGGLES_PRICING_RU.md` — модули и ценообразование.
- `PLATFORM_GLOBAL_ADMIN_DASHBOARD_RU.md` — зона `/platform`.
- `OMNICHANNEL_MULTITENANT_PLAN_RU.md`, `OMNICHANNEL_OPERATIONS_RUNBOOK_RU.md` — омниканал и эксплуатация.
- `VERCEL_SUPABASE_TEST_PROD.md` — окружения и секреты на Vercel/Supabase.

### `features/`

Продуктовые спеки и RFC (витрина, заказы, юридический UX и т.д.), в том числе:

- `AGGREGATOR_UX_FEATURES_RU.md` — главная города, избранное, повтор заказа, «настроение», отзывы (часть может быть в планах; сверять с кодом).
- `LEGAL_UX_PD_COOKIES_RF_PLAN_RU.md` — ПДн, cookie, согласия.
- `ORDER_STATUS_REALTIME_RFC_RU.md`, `ORDER_WORKFLOW_CUSTOMIZATION_OPTIONS_RU.md`, `ORDER_CHAT_OPERATOR_FLOW_RU.md` (статусы и филиал в Telegram-чате), `ORDER_BRANCH_LOAD_BALANCING_RU.md` (план режимов нагрузки), `HOME_CONFECTIONERS_ORDER_FLOW_PLAN_RU.md`, `REVIEWS_MODULE_ROLLOUT_RU.md`.

### `payments/`

- `PAYMENTS_RU_YOOKASSA_TBANK.md` — YooKassa / Т-Банк, webhooks.
- `PAYMENTS_TODO_RU.md` — открытые вопросы по платежам.

### `backlog/`

Планы оптимизации и доработок (checkout, tenant fetch, чат/доставка, перф витрины и т.д.). Статус чекбоксов внутри файлов — вручную.

### `runbooks/`

- `TELEGRAM_VERCEL_RELAY_RUNBOOK_RU.md`, `TELEGRAM_WG_SPLIT_TUNNEL_RUNBOOK_RU.md`
- `DEPLOY_SERVER_REGRU_SINGLE_VPS.md`, `SSH_RUNBOOK_REGRU_SERVER_RU.md`, `REGRU_DEPLOY_NUXT_NITRO_SUPABASE_CICD_PLAN_RU.md`
- `SELF_HOSTED_SUPABASE_SERVER_RUNBOOK_RU.md`

### `integrations/`

Контракты и планы: iiko, QuickResto, печать чеков, VK OAuth и др.; шаблон `INTEGRATION_PLAN_TEMPLATE_RU.md`.

### `verticals/festival/`

Продуктовые и партнёрские документы фестивального контура (MVP, архитектура, КП, лог прогресса).

### `content/`

- `brainstorm/` — диалоги, стратегия, тарифные наброски, сценарии рилсов (`reels/`). Может устаревать; при принятии решения переносить суть в `platform/` или `features/`.
- `instagram-carousels/` — сегменты и README для каруселей.

### `marketing/`

Варианты структуры партнёрского лендинга (`partners-landing-structure-*.md`).

### `meta/`

- `GSD_GET_SHIT_DONE_RU.md`
- `UI_UX_PRO_MAX_SKILL_RU.md`

## Устаревание

Документы в `content/brainstorm/` и части `features/` описывают намерения на момент написания. При расхождении с кодом приоритет у репозитория; для пользователей и команды фиксируйте факт выката в `reference/RECENT_MAJOR_CHANGES_RU.md`.

## Перенос (май 2026)

Ранее многие файлы лежали в корне `docs/` или в `docs/chat/`, `docs/TODO/`, `docs/deploy/`, `docs/festival/`. Пути в репозитории обновлены под новую схему; внешние закладки стоит поправить вручную.
