# Шаблон плана интеграции (пример: iiko)

Этот шаблон нужен, чтобы быстро запускать новые интеграции (iiko, r_keeper и др.) по единому стандарту TeleShop.

Использование:
- скопировать файл;
- переименовать в `docs/integrations/<provider>-integration-plan-ru.md`;
- заполнить секции ниже;
- держать совместимым с текущим подходом `mock-first -> http`.

---

## 0) Карточка интеграции

- Провайдер: `<iiko | ...>`
- Владелец интеграции: `<имя/роль>`
- Дата старта: `<YYYY-MM-DD>`
- Плановый релиз: `<YYYY-MM-DD>`
- Статус: `<draft | in-progress | ready-for-uat | done>`

## 1) Цель и бизнес-ценность

- Какие проблемы закрываем:
  - `<пример: убрать ручной дубляж заказов>`
  - `<пример: синхронизировать меню и стоп-листы>`
- Какая метрика успеха:
  - `<пример: % заказов, успешно доставленных в POS>`
  - `<пример: время обновления меню>`

## 2) Scope по этапам

### P0 (обязательный MVP)
- connect + health-check;
- menu sync (one-way);
- stop-list sync (webhook или fallback);
- базовая наблюдаемость.

### P1
- push заказов (outbox/retry/idempotency);
- статусы синка в заказе и dashboard.

### P2
- loyalty/promocode/дополнительные контуры.

### Out of scope
- `<что точно не делаем в этом цикле>`

## 3) Tenant и безопасность

- Все операции обязаны работать в контексте:
  - `shop_id` (всегда),
  - `restaurant_id` (где применимо).
- Обязательный маппинг:
  - `restaurant_id <-> <provider_place_id>`.
- Роли доступа:
  - критичные действия только `Owner`.

## 4) Конфигурация и feature toggles

- Конфиг в `shops.integration_keys.<provider>`.
- Fallback переменные `.env`:
  - `<PROVIDER_BASE_URL>`
  - `<PROVIDER_API_KEY>`
  - `<PROVIDER_MODE>`
  - `<PROVIDER_TIMEOUT_MS>`
- Режимы:
  - `mock` (по умолчанию для запуска),
  - `http` (после подтверждения реальных доступов).
- Toggle-модули:
  - `integration_<provider>_menu_sync`
  - `integration_<provider>_order_push`
  - `integration_<provider>_loyalty_bridge`
  - `integration_<provider>_promocode_sync`

## 5) API-контракт (документ)

Создать отдельный контракт:
- `docs/integrations/<provider>-api-contract.md`

В контракте зафиксировать:
- endpoint’ы провайдера;
- auth-модель;
- лимиты/rate limits;
- ошибки и retryable/non-retryable классы;
- таблицу маппинга полей `<provider> <-> TeleShop`.

## 6) Data model (миграции)

Минимальные сущности:
- `<provider>_sync_jobs` (job_type/status/mode/attempts/result/error);
- `<provider>_events` (external_event_id dedup/payload/processed/error);
- `<provider>_restaurant_mapping` (`restaurant_id <-> provider_place_id`);
- `<provider>_order_outbox` (idempotency/status/attempts/next_retry_at).

Заказы:
- поля в `orders`:
  - `external_order_id`,
  - `external_status`,
  - `last_sync_error`.

RLS:
- tenant policy для всех новых таблиц по `shop_id = current_shop_id()`.

## 7) Backend endpoints (минимум)

Dashboard:
- `POST /api/dashboard/integrations/<provider>/connect`
- `POST /api/dashboard/integrations/<provider>/health-check`
- `POST /api/dashboard/integrations/<provider>/menu-sync`
- `POST /api/dashboard/integrations/<provider>/stoplist-sync`
- `POST /api/dashboard/integrations/<provider>/orders/retry-failed`
- `POST /api/dashboard/integrations/<provider>/promocodes-sync`
- `GET /api/dashboard/integrations/<provider>`

Checkout/Webhook:
- `POST /api/checkout/<provider>/validate-promocode`
- `POST /api/webhooks/<provider>/menu-availability`

## 8) Integration layer

Создать единый клиент:
- `server/utils/<provider>.ts`

Внутри:
- `Mock<Provider>Client`
- `Http<Provider>Client`
- `get<Provider>Client()`
- `enqueue...Outbox()`
- `dispatch...Outbox()`

Требования:
- idempotency;
- retry/backoff;
- error normalization.

## 9) UI/UX в dashboard

Страница/блок интеграции должен включать:
- статус подключения + health;
- маппинг филиалов;
- действия sync/retry;
- таблицы последних jobs/events;
- smoke-seed кнопка для mock.

UX правило:
- ошибки/успехи через toast, не блокировать страницу.

## 10) Тест-план и приемка

Подготовить:
- `docs/integrations/<provider>-test-plan-ru.md`

Минимальные этапы:
- smoke в mock;
- menu/stop-list;
- order push + retry;
- promocode validation;
- mini-load (опционально).

Критерии PASS:
- без дублей;
- без tenant leakage;
- checkout не падает при сбоях внешнего API;
- observability достаточная для поддержки.

## 11) Что нужно от нас

- инженер интеграции;
- доступ Owner для тестов;
- окно тестирования/UAT;
- ответственный за go-live решение.

## 12) Что нужно от ресторана/партнера

- технический контакт;
- sandbox/prod credentials;
- маппинг филиалов;
- тестовые меню/промокоды/кейсы;
- подтверждение приемки.

## 13) Rollout и rollback

Rollout:
1. connect + health,
2. menu/stop-list,
3. order push,
4. loyalty/promocode.

Rollback:
- переключить provider mode в `mock` или отключить toggle;
- остановить dispatch worker;
- сохранить логи инцидента в jobs/events.

## 14) Definition of Done

- Все P0 обязательства закрыты и протестированы.
- P1/P2 в статусе по согласованному scope.
- Есть:
  - API contract,
  - test plan,
  - dashboard observability,
  - go-live чеклист.

---

## Быстрый чеклист перед стартом реализации

- [ ] Согласован scope (P0/P1/P2)
- [ ] Назначен владелец интеграции
- [ ] Подготовлен API contract
- [ ] Подготовлены миграции + RLS
- [ ] Настроен mock-first контур
- [ ] Согласован тест-план и UAT критерии
