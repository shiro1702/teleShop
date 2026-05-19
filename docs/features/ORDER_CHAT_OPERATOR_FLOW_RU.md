# Операторский чат: статусы заказа и переназначение филиала (Telegram)

**Статус:** реализовано для **Telegram** (unified order flow).  
**Связанные документы:** [`ORDER_WORKFLOW_CUSTOMIZATION_OPTIONS_RU.md`](ORDER_WORKFLOW_CUSTOMIZATION_OPTIONS_RU.md), [`platform/OMNICHANNEL_OPERATIONS_RUNBOOK_RU.md`](../platform/OMNICHANNEL_OPERATIONS_RUNBOOK_RU.md), бэклог [`backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md`](../backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md).

---

## 1. Назначение

Дать диспетчеру и менеджерам филиала управление заказом **прямо в групповом чате Telegram** без обязательного захода в дашборд:

- принять заказ в работу и провести по этапам (доставка / самовывоз);
- сообщить клиенту о задержке;
- **переназначить исполняющий филиал** кнопками (если в сети больше одного активного филиала).

Внутренние операции (смена филиала) **не пугают клиента** лишними уведомлениями.

---

## 2. Два независимых слоя

| Слой | Что меняется | Где в коде |
|------|----------------|------------|
| **Исполнитель заказа** | `orders.restaurant_id` | `assignOrderBranchFromChat`, `POST /api/order` (автовыбор при доставке) |
| **Куда уходит уведомление** | `restaurants.manager_group_chat_id`, fallback `shops.manager_chat_id` | `resolveRecipients` в `server/utils/notifications.ts` |

Переназначение филиала обновляет **исполнителя** и текст карточки в текущем чате; опционально шлёт короткое сообщение в чат **нового** филиала. Маршрутизация «delivery → центральный чат / pickup → филиал» из бэклога **пока не настраивается в дашборде** — см. раздел 8.

---

## 3. Кто может нажимать кнопки

Callback принимается только из чатов, привязанных к организации:

- `shops.manager_chat_id` — центральный диспетчерский чат;
- `restaurants.manager_group_chat_id` — чат любого активного филиала этой организации.

Проверка: `canManageOrderFromManagerChat` в `server/utils/orderChatFlow.ts`.

---

## 4. Карточка нового заказа (кнопки)

При `ORDER_CREATED` в чат менеджера уходит текст заказа и inline-клавиатура (`buildManagerOrderInlineKeyboard`).

### Общие кнопки

| Кнопка | `callback_data` | Действие |
|--------|-----------------|----------|
| Принять в работу | `work__{orderId}` | `orders.status` → `in_progress`, клиенту короткое уведомление |
| Задержка (кухня) | `delayWork__{orderId}` | текст клиенту, запись в timeline |
| Сменить филиал | `brmenu__{orderId}` | меню выбора филиала (если филиалов > 1) |
| Написать клиенту | URL `tg://user?id=…` | открыть личку |
| Открыть заказ | URL дашборда | `/dashboard/orders/{id}` |
| ETA N мин | `etaWork_{N}_{orderId}` | ETA клиенту + timeline |

Лимит Telegram на `callback_data` — **64 байта**; для филиала используется индекс в списке: `br0__{uuid}`, `br1__{uuid}`, …

### Ветка «Доставка» (`fulfillment_type = delivery`)

После «Принять в работу»:

| Кнопка | `callback_data` | Статус БД |
|--------|-----------------|-----------|
| Передать курьеру | `courier__{orderId}` | `out_for_delivery` |
| Доставлен | `done__{orderId}` | `handed_to_customer` |
| Задержка (доставка) | `delayCourier__{orderId}` | только сообщение клиенту |

### Ветка «Самовывоз / QR / не delivery»

После «Принять в работу»:

| Кнопка | `callback_data` | Статус БД |
|--------|-----------------|-----------|
| Готов к выдаче | `pickup__{orderId}` | `ready_for_pickup` |
| Выдан клиенту | `done__{orderId}` | `handed_to_customer` |

Полная матрица статусов в дашборде: `utils/dashboardOrderStatus.ts`, обзор вариантов кастомизации — [`ORDER_WORKFLOW_CUSTOMIZATION_OPTIONS_RU.md`](ORDER_WORKFLOW_CUSTOMIZATION_OPTIONS_RU.md).

---

## 5. Переназначение филиала

### UX в чате

1. **Сменить филиал** → список активных филиалов (`is_active = true`), по 2 кнопки в ряд + **Назад** (`brcancel__{orderId}`).
2. Выбор филиала → `orders.restaurant_id` обновляется.
3. В `orders.metadata` (timeline) — запись «Филиал переназначен из чата: A → B».
4. Текст сообщения в чате обновляется (строки с 🏪 / 📍).
5. **Клиенту ничего не отправляется.**
6. В `manager_group_chat_id` **нового** филиала — короткое сообщение «Заказ переназначен на ваш филиал» (`notifyBranchAssignedInTelegram`).

### Ограничения

- Нельзя «переназначить» на тот же филиал (ответ в callback: «Заказ уже на этом филиале»).
- Валидация зоны доставки при смене филиала после создания заказа **не выполняется** (осознанно для диспетчера; при необходимости — отдельная задача).
- Смена филиала после старта кухни не сбрасывает `orders.status` автоматически.

---

## 6. Что видит клиент

Уведомления при смене статуса (`ORDER_STATUS_CHANGED`) уходят **только клиенту**, не дублируются в группу менеджеров.

Публичные статусы (есть человекочитаемый текст):

- `in_progress` — принят в работу;
- `ready_for_pickup` — готов к выдаче;
- `out_for_delivery` — передан курьеру;
- `handed_to_customer` — доставлен / выдан (формулировка зависит от `fulfillment_type`);
- `cancelled` — отменён.

**Не уведомляем:** `new`, смена филиала, служебные записи timeline.

Тексты: `buildCustomerStatusShortText` в `server/utils/orderChatFlowPure.ts`, доставка через `dispatchNotificationEvent` → `buildCustomerOrderStatusShortMessage` в `notifications.ts`.

---

## 7. Точки входа в коде

| Компонент | Путь |
|-----------|------|
| Парсинг callback, клавиатуры (без БД) | `server/utils/orderChatFlowPure.ts` |
| Назначение филиала, ACL чата | `server/utils/orderChatFlow.ts` |
| Статус из чата + timeline | `server/utils/orderFlowActions.ts` → `applyOrderStatusFromChat` |
| Webhook Telegram | `server/api/webhook.post.ts` |
| Карточка заказа при создании | `server/utils/notifications.ts` |
| Тесты callback/клавиатур | `tests/orderChatFlow.spec.ts` |

---

## 8. Не в scope текущей реализации

См. [`backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md`](../backlog/CHAT_ROUTING_DELIVERY_PICKUP_PLAN_RU.md):

- [ ] Настройка в дашборде: delivery → центральный чат, pickup → филиал.
- [ ] Индикатор нагрузки по филиалам в UI менеджера.
- [ ] Автовыбор филиала по загрузке (`geo_least_loaded`) вместо только geo/цены.
- [ ] Те же inline-кнопки в **MAX** (`webhook-max.post.ts`).
- [ ] Переназначение филиала из дашборда (отдельный API).

---

## 9. Проверка после деплоя

1. Организация с **≥ 2** активными филиалами, привязанными групповыми чатами (или центральный `manager_chat_id`).
2. Создать тестовый заказ → в чате есть **Сменить филиал**.
3. Переназначить → в timeline заказа запись, клиент без лишних сообщений, новый филиал получил уведомление.
4. **Принять в работу** → клиент получил короткий статус.
5. Для pickup: **Готов к выдаче** → **Выдан**; для delivery: **Курьер** → **Доставлен**.

При ошибках кнопок смотреть логи `webhook.post.ts` и таблицу `notification_events` (runbook омниканала).
