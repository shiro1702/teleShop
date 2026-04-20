# Реализация апсейла и кросс-сейла в корзине / checkout

Документ для постановки задачи: **рекомендации товаров** рядом с уже существующим блоком прогресса «до бесплатной доставки», настройки в дашборде и согласованность с доставкой, промо и стоп-листом филиала.

## Связанные продуктовые документы

| Документ | Что зафиксировать при реализации |
|----------|-----------------------------------|
| [`docs/MULTI_TENANT_SAAS.md`](../MULTI_TENANT_SAAS.md) §15 | Сториз, промо, лояльность; отсылка к меню и кросс-селлу |
| [`pages/dashboard/menu.md`](../../pages/dashboard/menu.md) §«Настройка рекомендаций», §6 «Кросс-селл в корзине» | Связи товар↔товар, категория↔категория; примеры правил по корзине |
| [`docs/TODO/CART_CHECKOUT_FETCH_OPTIMIZATION_PLAN_RU.md`](./CART_CHECKOUT_FETCH_OPTIMIZATION_PLAN_RU.md) | Не раздувать число запросов на `checkout.vue`; кеширование / объединение эндпоинтов |

---

## Текущее состояние в коде (опираться на это)

### UI и логика «до бесплатной доставки»

- Файл: [`pages/checkout.vue`](../../pages/checkout.vue).
- Вычисление прогресса: computed `deliveryProgress` — использует `cartStore.deliveryZone`, поля `freeDeliveryThreshold`, и **субтотал после промо** при наличии успешного [`promoPreview`](#промо-и-субтотал) (`subtotalAfterPromo`), иначе `cartStore.total`.
- Зона доставки попадает в Pinia через [`useCheckoutAddress.ts`](../../composables/useCheckoutAddress.ts) → `cartStore.setDeliveryZone`.

### Зоны доставки (БД и API)

| Слой | Файлы / объекты |
|------|-----------------|
| Таблица | `public.restaurant_delivery_zones` — колонки `min_order_amount`, `delivery_cost`, `free_delivery_threshold`, `priority` (см. миграции [`003_restaurants_and_zones.sql`](../../supabase/migrations/003_restaurants_and_zones.sql), [`018_restaurant_delivery_zones_priority.sql`](../../supabase/migrations/018_restaurant_delivery_zones_priority.sql)) |
| Резолв точки в зону | [`server/utils/resolveDeliveryForPoint.ts`](../../server/utils/resolveDeliveryForPoint.ts) |
| Публичное API зон | [`server/api/restaurant-zones.get.ts`](../../server/api/restaurant-zones.get.ts) |
| Checkout: загрузка филиалов и зон | [`composables/useCheckoutTenantRestaurants.ts`](../../composables/useCheckoutTenantRestaurants.ts) — маппинг `freeDeliveryThreshold`, `minOrderAmount` из ответа API |
| Дашборд филиала | [`pages/dashboard/branches/[id]/zones.vue`](../../pages/dashboard/branches/[id]/zones.vue), [`server/api/dashboard/branches/[id]/zones*.ts`](../../server/api/dashboard/branches/) |

Тип на клиенте для свойств зоны: [`utils/deliveryZones.ts`](../../utils/deliveryZones.ts) — `DeliveryZoneProperties` (`minOrderAmount`, `deliveryCost`, `freeDeliveryThreshold`, `priority`).

### Корзина

- Store: [`stores/cart.ts`](../../stores/cart.ts) — `CartItem`, `deliveryZone`, `total`, метод `setDeliveryZone`.

### Каталог товаров для витрины

- [`server/api/products.get.ts`](../../server/api/products.get.ts) — выборка `products` по `shop_id`, модификаторы/параметры, ограничения по `fulfillment_type` (заголовок `x-fulfillment-type` / query `fulfillment_type`).

### Промо и субтотал

Рекомендуемые суммы для «добить до порога» **должны быть согласованы** с тем, как считается доставка:

- Эндпоинт: [`server/api/promo/preview.post.ts`](../../server/api/promo/preview.post.ts) — возвращает `subtotalAfterPromo`, данные лояльности.
- На checkout промо дергается из `checkout.vue` (функции вроде `runPromoPreview`), см. блок вокруг `deliveryProgress` и `summaryDeliveryCost`.

Инвариант: если показываете пользователю «осталось X ₽ до бесплатной доставки», база для X — та же, что в `deliveryProgress` в [`checkout.vue`](../../pages/checkout.vue) (`promoPreview.subtotalAfterPromo` или `cartStore.total`).

### Стоп-лист и скрытие на филиале

- Таблица: `restaurant_product_overrides` (`is_in_stop_list`, `is_hidden`, переопределение цены) — синк и дашборд уже используются в проекте.
- Любой апсейл должен **фильтровать** позиции недоступные для выбранного `restaurant_id` (и учитывать `delivery_restricted` / окна доступности там, где это уже делается для каталога).

### Заказ на сервере

- [`server/api/order.post.ts`](../../server/api/order.post.ts) — валидация зоны, в т.ч. `minOrderAmount`, `freeDeliveryThreshold` с сервера.
- Прайсинг строк: [`server/utils/orderLinePricing.ts`](../../server/utils/orderLinePricing.ts) (`loadTenantProductsForOrder`).

---

## Целевой функционал (MVP → расширение)

### MVP

1. **Связи «товар → рекомендованные товары»** (3–5 SKU) — ручная настройка в дашборде.
2. **Связи «категория → категория для кросс-сейла»** (например «Пиццы» → «Соусы»).
3. **Глобальные рекомендации по категориям** (fallback): админ выбирает 1-2 категории, которые всегда можно показывать в корзине, если персональные связи не дали достаточный пул.
4. На **корзине / checkout** блок «С этим заказывают» / «Добавьте к заказу»:
   - кандидаты из пересечения правил по **товарам в корзине** и **категориям** этих товаров;
   - fallback на глобальные категории (из пункта выше), если после фильтрации кандидатов мало;
   - исключить уже добавленные `product.id`;
   - исключить «сложные» SKU, требующие обязательного выбора модификаторов перед добавлением;
   - при **доставке** и наличии `freeDeliveryThreshold > 0` — опционально **приоритизировать** товары с ценой ≤ «остаток до бесплатной доставки» (микро-копирайт в UI).
5. Добавление в корзину в один тап (reuse `cartStore.addItem` / тот же флоу, что у [`ProductCard.vue`](../../components/ProductCard.vue)).
6. Ограничение выдачи в UI: не более 4-6 карточек в карусели, без дубликатов.

### Следующие этапы (не блокируют MVP)

- Правила вида «если в корзине категория A → показать товар B» (отдельная таблица или JSON-правила).
- Скидка на апсейл-товар при достижении условия (пересечение с [`server/utils/pricingPromoBonus.ts`](../../server/utils/pricingPromoBonus.ts) и промокодами — осторожно с дублированием логики).

---

## Модель данных (новое)

Ниже — предлагаемая схема; имена можно скорректировать под стиль проекта, но нужны **FK на `shop_id`** и уникальность в рамках магазина.

### Таблица 1: рекомендации с товара

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | `uuid` PK | |
| `shop_id` | `uuid` FK → `shops` | как у остальных сущностей каталога |
| `source_product_id` | `uuid` FK → `products` | товар-источник |
| `target_product_id` | `uuid` FK → `products` | рекомендация |
| `sort_order` | `int` | порядок |
| Уникальность | | `(source_product_id, target_product_id)` |

Индексы: `(shop_id)`, `(source_product_id)`.

### Таблица 2: кросс-сейл категорий

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | `uuid` PK | |
| `shop_id` | `uuid` FK → `shops` | |
| `source_category_id` | `uuid` FK → `categories` | |
| `target_category_id` | `uuid` FK → `categories` | подборка товаров из этой категории |
| `sort_order` или `max_items` | | ограничить число SKU из категории |

Индексы: `(shop_id)`, `(source_category_id)`.

### RLS

По аналогии с [`categories` / `products`](../../supabase/migrations/012_menu_system.sql): политики через `shop_members` для дашборда; для **публичного чтения** рекомендаций — сервисная роль в Nitro (`serverSupabaseServiceRole`) без выдачи прав анониму напрямую из браузера к таблице (предпочтительно отдавать рекомендации **только через API**, см. ниже).

---

## API (новые и изменения)

### Рекомендуемый контракт: один эндпоинт для витрины

`POST /api/cart/recommendations` (или `GET` с query, если объём маленький — но POST удобнее для списка id из корзины).

**Тело (пример):**

```json
{
  "restaurantId": "<uuid>",
  "fulfillmentType": "delivery",
  "cartProductIds": ["..."],
  "limit": 8
}
```

**Ответ:** список товаров в том же духе, что фрагмент [`products.get.ts`](../../server/api/products.get.ts): минимум `id`, `name`, `price`, `image`, `category_id`, данные для открытия модалки (модификаторы/параметры — либо вложить, либо ленивая загрузка по клику).

**Сервер обязан:**

1. Проверить тенант: `requireTenantShop` — как в [`products.get.ts`](../../server/api/products.get.ts).
2. Собрать кандидатов из таблиц рекомендаций + категорийных кросс-сейлов.
3. Исключить id из `cartProductIds`.
4. Загрузить **`restaurant_product_overrides`** для `restaurantId`: выкинуть стоп, скрытые; применить цену филиала если так заведено в проекте.
5. Отфильтровать по доступности доставки/меню (как в каталоге: `evaluateMenuAvailability`, `delivery_restricted` — см. импорты в `products.get.ts`).
6. Опционально: параметр «приоритет ценой ≤ remaining» если передан `remainingToFreeDeliveryRub` (считается на клиенте из `deliveryProgress.remaining` или дублируется на сервере из зоны — **важно** использовать ту же базу субтотала, что и промо).
7. Возвращать не более `limit` позиций (по умолчанию 6), с легкой ротацией внутри подходящего пула, чтобы подборка не выглядела всегда одинаковой.

**Заголовки:** как у остальных запросов витрины — `x-shop-id` / как принято в [`checkout.vue`](../../pages/checkout.vue) для `checkoutXShopIdHeaders()`.

### Дашборд (CRUD)

Минимум:

- `GET/PATCH` (или отдельные POST/DELETE) в [`server/api/dashboard/menu/`](../../server/api/dashboard/) по аналогии с существующими ресурсами меню — привязка к `shop_id` из сессии/роли.

Зависимость: те же проверки прав, что для редактирования категорий/товаров (`shop_members`).

---

## Тех-дизайн API (детализация для реализации)

### 1) Endpoint: `POST /api/cart/recommendations`

**Файл:** `server/api/cart/recommendations.post.ts`  
**Авторизация/tenant:** через `requireTenantShop(event)` + `x-shop-id`, как в `products.get.ts` и `promo/preview.post.ts`.

**Request body (предложение):**

```json
{
  "restaurantId": "uuid",
  "fulfillmentType": "delivery",
  "cartProductIds": ["uuid-1", "uuid-2"],
  "remainingToFreeDeliveryRub": 180,
  "limit": 6
}
```

**Правила валидации входа:**

- `restaurantId` обязателен, UUID.
- `fulfillmentType` только: `delivery | pickup | qr-menu`.
- `cartProductIds` массив UUID, пустой массив допустим.
- `remainingToFreeDeliveryRub` optional, если передан — `>= 0`.
- `limit` optional, clamp `1..12`, default `6`.

**Response 200 (предложение):**

```json
{
  "ok": true,
  "items": [
    {
      "id": "uuid",
      "name": "Картофель фри",
      "price": 180,
      "image": "https://...",
      "category_id": "uuid",
      "category": "Закуски",
      "score": 96,
      "reasons": ["product_link", "fits_remaining"]
    }
  ],
  "meta": {
    "limit": 6,
    "remainingToFreeDeliveryRub": 180
  }
}
```

`score`/`reasons` можно не отдавать в MVP, но полезно для диагностики и QA.

### 2) Алгоритм подбора (сервер)

Порядок (в одном endpoint, чтобы не размазывать логику по клиенту):

1. Проверить тенант `shop_id`.
2. Загрузить продукты корзины: `products(id, category_id)` для `cartProductIds`.
3. Построить пул кандидатов из:
   - `product -> product` связей;
   - `source_category -> target_category` (товары target-категорий);
   - глобальных категорий fallback.
4. Дедуп кандидатов по `product_id`.
5. Убрать `cartProductIds`.
6. Фильтрация филиала (`restaurant_product_overrides`):
   - `is_in_stop_list = true` исключить;
   - `is_hidden = true` исключить;
   - если есть branch price override — использовать ее как `price` в выдаче.
7. Фильтрация доступности: `evaluateMenuAvailability` (как в `GET /api/products`) с тем же `fulfillmentType`.
8. Исключить «не one-click» SKU:
   - если у товара есть обязательная parameter-group/modifier-group (`isRequired`/`minSelect > 0`) — не выдавать в upsell-карусель.
9. Скоорить кандидаты:
   - base score по источнику (`product_link` > `category_link` > `global_fallback`);
   - +bonus если `price <= remainingToFreeDeliveryRub` и `remaining > 0`;
   - +стабильная псевдо-рандомизация (seed от `shopId + restaurantId + day`) для ротации.
10. Отсортировать, взять top `limit`.

### 3) SQL/данные (минимальные таблицы)

- `cart_cross_sell_product_links` (`shop_id`, `source_product_id`, `target_product_id`, `sort_order`)
- `cart_cross_sell_category_links` (`shop_id`, `source_category_id`, `target_category_id`, `sort_order`)
- `cart_cross_sell_global_categories` (`shop_id`, `target_category_id`, `sort_order`)

Уникальные индексы:

- `(shop_id, source_product_id, target_product_id)`
- `(shop_id, source_category_id, target_category_id)`
- `(shop_id, target_category_id)` для global fallback

### 4) Ошибки и контракты

- `400` — невалидный body (`restaurantId`, `fulfillmentType`, UUID и т.д.).
- `404` — ресторан не относится к текущему тенанту.
- `500` — ошибка чтения БД.

Формат ошибки (как в других endpoint проекта):

```json
{ "ok": false, "error": "message" }
```

### 5) Производительность

- Один round-trip с батч-запросами лучше, чем несколько вызовов из клиента.
- Ограничить исходный пул SQL `LIMIT 100` до пост-фильтрации.
- Дебаунс на клиенте `300-450ms` (как у promo preview).
- Ключ подписи запроса: `shopId + restaurantId + fulfillmentType + cartProductIds + remaining`.

---

## Что уже сделано в коде и куда применять изменения

### Уже реализовано (можно переиспользовать как есть)

- `pages/checkout.vue`:
  - есть блок `deliveryProgress` рядом с CTA и уже корректный расчет от `promoPreview.subtotalAfterPromo`/`cartStore.total`;
  - есть `checkoutXShopIdHeaders()` и общая схема `$fetch` для tenant-aware API;
  - есть debounce/watch-паттерн (`promoPreviewWatchSignature`) для недорогого обновления при изменении корзины.
- `stores/cart.ts`:
  - есть все данные для сигнатуры запроса (`items`, `id`, `quantity`, `cartItemId`, `selected*`);
  - есть one-click добавление через `addItem(...)`.
- `server/api/products.get.ts`:
  - уже реализованы фильтры доступности по `fulfillmentType` (`evaluateMenuAvailability`);
  - уже есть загрузка модификаторов/параметров, по которым можно определить «сложные SKU».
- `composables/useCheckoutTenantRestaurants.ts`:
  - уже есть контроль `selectedRestaurantId` и обновление зон/филиала;
  - это правильная точка для инвалидации/перезапроса рекомендаций при смене филиала.
- `composables/useTenantRestaurantsCache.ts`:
  - уже внедрен TTL/in-flight cache для ресторанов; паттерн можно повторить для рекомендаций.

### Пока отсутствует (нужно добавить)

- Endpoint `POST /api/cart/recommendations` отсутствует.
- Таблицы/CRUD для cross-sell правил (product/category/global fallback) отсутствуют.
- UI-компонент карусели апсейла на checkout отсутствует.

### Куда вносить изменения (точки интеграции)

1. **Сервер API**
   - Добавить `server/api/cart/recommendations.post.ts`.
   - Переиспользовать utility-функции из `products.get.ts` (availability + параметры/модификаторы), чтобы не плодить дубли.

2. **Checkout клиент**
   - В `pages/checkout.vue` добавить `upsellItems`, `isUpsellLoading`, `upsellError`, `runUpsellRecommendations`.
   - В template вставить блок карусели сразу под `deliveryProgress` (правильное место по UX из чата).
   - Вызовы `runUpsellRecommendations` привязать к watch-сигнатуре:
     - `cartStore.items` (product ids),
     - `selectedRestaurantId`,
     - `state.fulfillmentType`,
     - `deliveryProgress.remaining` (или `null`).

3. **Компонент**
   - Вынести визуал в `components/checkout/CartUpsellStrip.vue`, чтобы не раздувать `checkout.vue`.
   - Внутри кнопки «Добавить» использовать `cartStore.addItem` только для one-click SKU.

4. **Дашборд**
   - Добавить CRUD API в `server/api/dashboard/menu/*` рядом с категориями/товарами/модификаторами.
   - Добавить UI-настройки в menu dashboard для трех уровней правил (product/category/global).

5. **Согласованность iiko/internal**
   - Применять в дашборде и документации: при `iiko` запрещаем редактировать master-данные меню, но cross-sell правила оставляем в нашей админке.

---

## Клиент: файлы для правок

| Файл | Задача |
|------|--------|
| [`pages/checkout.vue`](../../pages/checkout.vue) | Вставить блок апсейла рядом с UI `deliveryProgress`; вызов API после известных `cartStore.items`, `selectedRestaurantId`, адреса/зоны; обработка loading/error |
| [`pages/cart.vue`](../../pages/cart.vue) / обёртки город+тенант | Если корзина показывает тот же layout — синхронизировать монтирование (см. оптимизационный TODO) |
| [`stores/cart.ts`](../../stores/cart.ts) | При необходимости: облегчённый список id для запроса рекомендаций (computed или метод) |
| [`composables/useCheckoutTenantRestaurants.ts`](../../composables/useCheckoutTenantRestaurants.ts) | Убедиться, что при смене филиала инвалидируются рекомендации |

Компонент (опционально выделить): например `components/checkout/CartUpsellStrip.vue` — пропсы: товары, `remainingRub`, `onAdd`.

---

## Согласованность с порогами доставки и минималки

| Величина | Источник истины |
|----------|-----------------|
| Зона | `cartStore.deliveryZone` после резолва адреса |
| Остаток до бесплатной доставки | Как в `deliveryProgress` в [`checkout.vue`](../../pages/checkout.vue): `zone.freeDeliveryThreshold - subtotalForThreshold` |
| Субтотал для порога | `promoPreview.subtotalAfterPromo` если `promoPreview.ok`, иначе `cartStore.total` |
| Минимальный заказ | `deliveryZone.minOrderAmount` — можно показать **второй** прогресс-бар или объединённый текст; на клиенте уже есть геттер `canCheckout` и `deliverySummary` в [`stores/cart.ts`](../../stores/cart.ts) |

---

## Порядок работ (рекомендуемый)

1. Миграция Supabase: две таблицы + индексы + RLS (добавить таблицу/настройку глобальных категорий для fallback, если не хранится в существующих настройках меню).
2. Сервер: `POST /api/cart/recommendations` (или выбранное имя) + unit/интеграционная проверка фильтрации стоп-листа, сложных SKU и лимита выдачи.
3. Дашборд: UI в карточке товара, категории и блоке глобальных рекомендаций (пути из [`pages/dashboard/menu.md`](../../pages/dashboard/menu.md)) + API сохранения.
4. Витрина: блок в `checkout.vue`, дебаунс запроса при изменении корзины, пустое состояние.
5. Обновить документацию/подсказки в дашборде: для клиентов с iiko меню и модификаторы редактируются в iiko (master), а кросс-сейл настраивается в нашей админке.

---

## Статусы по задаче

### Уже сделано

- [x] Актуализирован продуктовый план по апсейлу/кросс-сейлу на основе чата `docs/chat/апсейл.md`.
- [x] Добавлена гибридная модель `iiko + internal` в план.
- [x] Добавлен тех-дизайн API для `POST /api/cart/recommendations`.
- [x] Зафиксированы точки интеграции в текущем коде (`checkout`, `cart`, `products`, `tenant restaurants`).

### Ближайшие шаги (next)

- [ ] Создать миграции таблиц cross-sell (product links, category links, global fallback categories) + индексы + RLS.
- [ ] Реализовать `server/api/cart/recommendations.post.ts` с фильтрами: stop-list, hidden, availability, one-click SKU.
- [ ] Добавить компонент карусели апсейла и подключить его в `pages/checkout.vue` рядом с `deliveryProgress`.
- [ ] Подключить debounce/watch-подпись для пересчета рекомендаций при изменении корзины, филиала и `remainingToFreeDelivery`.
- [ ] Добавить базовые серверные тесты на фильтрацию и лимит выдачи.

### План на будущее

- [ ] Дашборд-редактор правил (товар->товар, категория->категория, глобальные категории).
- [ ] Расширить ранжирование рекомендаций (вес по конверсии, ротация, A/B режим).
- [ ] Добавить персонализацию на истории заказов (после запуска MVP).
- [ ] Добавить аналитику эффективности блока: CTR, add-to-cart rate, uplift среднего чека.
- [ ] Подготовить режимы “умных целей” (добивка до бесплатной доставки, до минималки, до промо-порога).

---

## Модель интеграции с iiko / internal (обязательное решение)

- Поддерживаем **оба режима** на уровне тенанта: `internal` и `iiko` (гибридная архитектура).
- Для `iiko`:
  - меню/цены/стоп-листы/модификаторы синхронизируются из iiko в локальный кэш;
  - при оформлении заказа сервер отправляет заказ в iiko;
  - редактирование «мастер-данных» меню в нашей админке ограничено/заблокировано.
- Для `internal`: меню и модификаторы ведутся полностью в нашей БД.
- Кросс-сейл в корзине (правила рекомендаций и «добивка до порога») реализуется на нашей стороне **для обоих режимов**, чтобы не зависеть от ограничений iiko UI и иметь единое поведение витрины.

---

## Чеклист приёмки

- [ ] Рекомендации не содержат товаров из стоп-листа выбранного филиала.
- [ ] Не показываются позиции, несовместимые с `fulfillmentType` доставки.
- [ ] При применённом промо остаток «до бесплатной доставки» совпадает с логикой блока прогресса.
- [ ] Смена ресторана/адреса обновляет подборку.
- [ ] Нет лишнего дублирования тяжёлых запросов при каждом клике (см. [оптимизация fetch](./CART_CHECKOUT_FETCH_OPTIMIZATION_PLAN_RU.md)).
- [ ] Для `iiko`-тенантов рекомендации в корзине работают на наших правилах, а не на UI-настройках iiko.
- [ ] В апсейл-карусель не попадают SKU, которые нельзя добавить в 1 клик из-за обязательных модификаторов.

---

## Краткий список существующих зависимостей (для быстрого поиска)

**БД:** `shops`, `products`, `categories`, `restaurants`, `restaurant_delivery_zones`, `restaurant_product_overrides`.  
**API:** `GET /api/products`, `GET /api/restaurant-zones`, `POST /api/promo/preview`, `POST /api/order`.  
**Утилиты:** `requireTenantShop`, `resolveDeliveryForPoint`, `loadTenantProductsForOrder`, `evaluateMenuAvailability`.  
**Клиент:** `pages/checkout.vue`, `stores/cart.ts`, `useCheckoutTenantRestaurants.ts`, `useCheckoutAddress.ts`.
