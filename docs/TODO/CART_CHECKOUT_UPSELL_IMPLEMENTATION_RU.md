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
3. На **корзине / checkout** блок «С этим заказывают» / «Добавьте к заказу»:
   - кандидаты из пересечения правил по **товарам в корзине** и **категориям** этих товаров;
   - исключить уже добавленные `product.id`;
   - при **доставке** и наличии `freeDeliveryThreshold > 0` — опционально **приоритизировать** товары с ценой ≤ «остаток до бесплатной доставки» (микро-копирайт в UI).
4. Добавление в корзину в один тап (reuse `cartStore.addItem` / тот же флоу, что у [`ProductCard.vue`](../../components/ProductCard.vue)).

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

**Заголовки:** как у остальных запросов витрины — `x-shop-id` / как принято в [`checkout.vue`](../../pages/checkout.vue) для `checkoutXShopIdHeaders()`.

### Дашборд (CRUD)

Минимум:

- `GET/PATCH` (или отдельные POST/DELETE) в [`server/api/dashboard/menu/`](../../server/api/dashboard/) по аналогии с существующими ресурсами меню — привязка к `shop_id` из сессии/роли.

Зависимость: те же проверки прав, что для редактирования категорий/товаров (`shop_members`).

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

1. Миграция Supabase: две таблицы + индексы + RLS.
2. Сервер: `POST /api/cart/recommendations` (или выбранное имя) + unit/интеграционная проверка фильтрации стоп-листа.
3. Дашборд: UI в карточке товара и категории (пути из [`pages/dashboard/menu.md`](../../pages/dashboard/menu.md)) + API сохранения.
4. Витрина: блок в `checkout.vue`, дебаунс запроса при изменении корзины, пустое состояние.

---

## Чеклист приёмки

- [ ] Рекомендации не содержат товаров из стоп-листа выбранного филиала.
- [ ] Не показываются позиции, несовместимые с `fulfillmentType` доставки.
- [ ] При применённом промо остаток «до бесплатной доставки» совпадает с логикой блока прогресса.
- [ ] Смена ресторана/адреса обновляет подборку.
- [ ] Нет лишнего дублирования тяжёлых запросов при каждом клике (см. [оптимизация fetch](./CART_CHECKOUT_FETCH_OPTIMIZATION_PLAN_RU.md)).

---

## Краткий список существующих зависимостей (для быстрого поиска)

**БД:** `shops`, `products`, `categories`, `restaurants`, `restaurant_delivery_zones`, `restaurant_product_overrides`.  
**API:** `GET /api/products`, `GET /api/restaurant-zones`, `POST /api/promo/preview`, `POST /api/order`.  
**Утилиты:** `requireTenantShop`, `resolveDeliveryForPoint`, `loadTenantProductsForOrder`, `evaluateMenuAvailability`.  
**Клиент:** `pages/checkout.vue`, `stores/cart.ts`, `useCheckoutTenantRestaurants.ts`, `useCheckoutAddress.ts`.
