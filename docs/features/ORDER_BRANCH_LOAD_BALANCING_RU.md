# Распределение заказов между филиалами: режимы (план)

**Статус:** частично покрыто; **автобалансировка по нагрузке и настройки в дашборде — не реализованы.**  
**Реализовано сейчас:** ручное переназначение филиала из Telegram — [`ORDER_CHAT_OPERATOR_FLOW_RU.md`](ORDER_CHAT_OPERATOR_FLOW_RU.md).

---

## 1. Задача

Сеть из нескольких филиалов должна уметь:

1. **Автоматически** направлять заказ на менее загруженную точку (в пределах зоны доставки).
2. **Вручную** через диспетчерский чат или дашборд перераспределять заказы.
3. **Раздельно** маршрутизировать уведомления (центральный чат для delivery, филиальные для pickup).

---

## 2. Что уже есть в продукте

| Механизм | Поведение |
|----------|-----------|
| Доставка по адресу | `resolveDeliveryForPoint` — полигоны зон, сортировка: `delivery_cost` ↑, `priority` ↓, первый **открытый** филиал |
| Самовывоз / QR | клиент или чекаут выбирает `restaurant_id` |
| Уведомления | в чат филиала-исполнителя (`manager_group_chat_id`), fallback `shops.manager_chat_id` |
| Операторский чат | кнопка **Сменить филиал**, статусы по `fulfillment_type` — см. [`ORDER_CHAT_OPERATOR_FLOW_RU.md`](ORDER_CHAT_OPERATOR_FLOW_RU.md) |

---

## 3. Целевая модель настроек (не в коде)

Рекомендуемое место: `OrganizationOpsSettings` (`shops.ui_settings.organization.ops`) или `integration_keys` на уровне shop.

```ts
// концепт, не тип из репозитория
branchAssignment: {
  delivery: 'geo_cheapest' | 'geo_least_loaded' | 'manual_dispatch'
  pickup: 'customer_choice' | 'geo_least_loaded' | 'manual_dispatch'
}
notificationRouting: {
  delivery: 'executing_branch' | 'central_ops_group' | 'fulfillment_split'
  pickup: 'executing_branch' | 'central_ops_group'
}
```

### Ось A — исполняющий филиал (`orders.restaurant_id`)

| Режим | Описание |
|-------|----------|
| `geo_cheapest` | Текущее поведение `resolveDeliveryForPoint` |
| `geo_least_loaded` | Среди кандидатов по зоне — минимум активных заказов (`new`, `in_progress`, …) |
| `manual_dispatch` | Заказ без финального филиала до действия диспетчера |

### Ось B — чат уведомлений

| Режим | Описание |
|-------|----------|
| `executing_branch` | Как сейчас: `resolveRecipients` по `restaurant_id` заказа |
| `central_ops_group` | Всегда `shops.manager_chat_id` |
| `fulfillment_split` | delivery → central, pickup → branch (из бэклога) |

Оси **нельзя смешивать в одну настройку**: смена филиала не должна слать клиенту `ORDER_STATUS_CHANGED`.

---

## 4. Метрика нагрузки (MVP)

Для `geo_least_loaded` на момент `POST /api/order`:

```sql
-- концепт
SELECT restaurant_id, COUNT(*) AS active
FROM orders
WHERE shop_id = $1
  AND status IN ('new', 'in_progress', 'ready_for_pickup', 'out_for_delivery')
GROUP BY restaurant_id;
```

При равенстве — текущий tie-break (стоимость доставки, `priority` зоны). При росте нагрузки — кэш снимка на 30–60 с.

---

## 5. Порядок внедрения

1. Дашборд: переназначение `restaurant_id` + timeline (дополнение к чату).
2. `resolveFulfillmentBranch` в `order.post.ts` + режим `geo_least_loaded`.
3. `resolveRecipients` + `fulfillment_split` / `central_ops_group`.
4. UI: счётчик активных заказов по филиалам на `/dashboard/orders/manager`.
5. MAX: parity с Telegram webhook.

Детальный чеклист бэклога: [`backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md`](../backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md).
