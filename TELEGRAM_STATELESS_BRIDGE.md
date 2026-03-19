# Stateless‑мост Web → Telegram Mini App через «упакованный» токен корзины (`startapp` / `start_param`)

Документ описывает, как в проекте реализован **безБД‑подход** для передачи корзины
из внешнего веб‑сайта в Telegram Mini App через компактный токен, передаваемый
в `startapp` (deep link) и `start_param` (внутри Mini App).

---

## 1. Задача

Нужно было:

- дать пользователю на **веб‑сайте** собрать корзину;
- по кнопке «Продолжить в Telegram» открыть **Mini App** бота;
- восстановить корзину в Mini App **без хранения черновиков в БД**;
- при этом не нарушать ограничения Telegram по длине параметров (64 байта).

Решение — **stateless‑токен**, который полностью восстанавливает корзину только
по данным из URL (без сервера состояния).

---

## 2. Формат «упакованного» токена

Токен содержит _только_ то, что нужно для восстановления корзины:

- `shop_id` магазина;
- список позиций `[{ id, quantity }]`;
- без цен, без адреса, без комментариев (всё это либо уже есть на стороне Mini App,
  либо не критично для самого перехода).

### 2.1. Сериализация (текущий формат)

1. **Шаг 1 — compact items string:**

   - каждая позиция: `<id>x<qty>`;
   - позиции разделены запятыми.

   Пример:

   - корзина: `[{ id: "1", q: 2 }, { id: "5", q: 1 }]`;
   - строка: `1x2,5x1`.

2. **Шаг 2 — JSON + base64url:**

   - payload: `{ s: "<shop_id|null>", i: "1x2,5x1" }`;
   - payload кодируется в `base64url` → это и есть токен.

**Важно:** подпись (HMAC) здесь не используется, потому что:

- итоговая сумма заказа всё равно **пересчитывается на сервере по Supabase products**;
- таким образом, подмена токена может изменить только набор/кол‑во товаров,
  но не даёт возможности «нарисовать» свои цены.

---

## 3. Эндпоинты моста

### 3.1. `POST /api/cart-bridge` — создание токена и deep link

**Назначение:** на веб‑сайте по содержимому корзины создать stateless‑токен и
вернуть готовую ссылку в Telegram Mini App.

**Тело запроса (JSON):**

```json
{
  "items": [
    { "id": "1", "quantity": 2 },
    { "id": "5", "quantity": 1 }
  ]
}
```

**Ключевая логика:**

```12:49:/Users/arsalanbaranzaev/Desktop/projects/teleShop/server/api/cart-bridge.post.ts
interface BridgeItemInput {
  id: string
  quantity: number
}

function encodeItems(items: BridgeItemInput[]): string {
  const compact = items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.id}x${item.quantity}`)
    .join(',')

  return Buffer.from(compact, 'utf8').toString('base64url')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const botName = (config.public as any).telegramBotName as string | undefined

  if (!botName) {
    throw createError({ statusCode: 500, message: 'telegramBotName is not configured' })
  }

  const body = await readBody<BridgeRequestBody | null>(event)
  if (!body?.items?.length) {
    throw createError({ statusCode: 400, message: 'Expected items for bridge token' })
  }

  const token = encodeItems(body.items)

  const deepLink = `https://t.me/${botName}?startapp=${encodeURIComponent(token)}`

  return {
    ok: true,
    token,
    deepLink,
  }
})
```

**Ответ:**

```json
{
  "ok": true,
  "token": "<base64url>",
  "deepLink": "https://t.me/<botName>?startapp=<base64url>"
}
```

С фронта веб‑сайта далее делается обычный редирект:

- `window.location.href = deepLink`.

---

### 3.2. `GET /api/cart-bridge?token=...` — расшифровка токена в Mini App

**Назначение:** по токену из `start_param` восстановить корзину, взяв данные
о товарах из сервера по tenant (`shop_id` внутри токена).

**Ключевая логика:**

```ts
// server/api/cart-bridge.get.ts (актуально)
// 1) decode token -> { shopId, items }
// 2) если есть shopId: загрузить продукты из Supabase по shop_id
// 3) fallback для legacy token без shopId: старый формат
// 4) вернуть нормализованные позиции корзины для Pinia
```

**Ответ:**

- `200 { ok: true, items: CartItem[] }`
- `400` — битый токен или отсутствие параметра.

---

## 4. Поведение фронтенда (Web и TMA)

### 4.1. Веб‑корзина: кнопка «Продолжить в Telegram»

В текущей версии переход «Продолжить в Telegram» вызывается из `checkout.vue`.
Клиент отправляет `items` + tenant context (`shop_id`) в `POST /api/cart-bridge`.

**Итого:** пользователь на сайте нажимает «Продолжить в Telegram» → генерируется токен →
браузер открывает `https://t.me/<bot>?startapp=<token>`.

---

### 4.2. Mini App: восстановление корзины по `start_param`

При запуске Mini App Telegram кладёт токен из `startapp` в `initDataUnsafe.start_param`.

Типы Telegram WebApp расширены, чтобы это было типобезопасно:

```16:21:/Users/arsalanbaranzaev/Desktop/projects/teleShop/types/telegram.d.ts
WebApp: {
  ready: () => void
  initData: string
  initDataUnsafe?: {
    start_param?: string
    [key: string]: unknown
  }
  MainButton: { ... }
}
```

Плагин `telegram.client.ts` читает `start_param`, дергает `GET /api/cart-bridge`
и наполняет Pinia‑корзину:

```1:28:/Users/arsalanbaranzaev/Desktop/projects/teleShop/plugins/telegram.client.ts
export default defineNuxtPlugin(() => {
  const cartStore = useCartStore()
  const { webApp, isTelegram, hideMainButton } = useTelegram()

  if (!isTelegram.value || !webApp.value) return

  const startParam = webApp.value.initDataUnsafe?.start_param
  if (startParam) {
    $fetch<{ ok: boolean; items: any[] }>('/api/cart-bridge', {
      method: 'GET',
      params: { token: startParam },
    })
      .then((res) => {
        if (res?.ok && Array.isArray(res.items) && res.items.length > 0) {
          cartStore.clear()
          res.items.forEach((item) => {
            cartStore.addItem(
              {
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                description: item.description ?? undefined,
                category: item.category,
              },
              item.quantity,
            )
          })
        }
      })
      .catch((err) => {
        console.error('Failed to restore cart from token:', err)
      })
  }

  webApp.value.ready()
  hideMainButton()
})
```

**Поведение:**

1. Пользователь переходит по deep link из веб‑сайта.
2. Telegram запускает Mini App с `start_param = <token>`.
3. Плагин:
   - читает `start_param`,
   - тянет реальные данные товаров с бэкенда,
   - наполняет Pinia‑корзину.
4. Пользователь видит в TMA уже предзаполненную корзину и может оформить заказ
   по обычному потоку (`POST /api/order` с `initData`).

---

## 5. Безопасность и ограничения

- **Цены и итоговая сумма** пересчитываются в `/api/order` по tenant-таблице `products`.
- Токен по сути — «мини‑описание корзины», а не источник правды о цене.
- Длина токена зависит от количества и формата `id`, но в типичном кейсе
  с короткими строковыми id и небольшим числом позиций он хорошо вписывается
  в лимит Telegram (64 байта для `startapp` / `start_param`).

Так реализуется **stateless‑подход без черновиков корзины в БД**: весь контекст,
нужный для восстановления корзины, передаётся в URL, а сервер использует tenant
данные каталога для проверки и пересчёта.

