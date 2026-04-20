## Backend TODO: Omnichannel (Web + Telegram Mini App)

Этот файл описывает, что нужно реализовать на бэкенде (Nuxt 3 / Nitro), чтобы довести архитектуру до полноценной омниканальности: единый бэкенд, обслуживающий внешний веб‑сайт и Telegram Mini App.

См. также целевой мультитенантный омниканальный план:
- `docs/OMNICHANNEL_MULTITENANT_PLAN_RU.md`

---

### 1. Composable `useTelegram` (детект среды + UI‑режим)

**Цели**

- Определять, запущено ли приложение внутри Telegram WebApp (`isTelegram`).
- Давать удобный API для интеграции с Telegram WebApp API (в т.ч. `MainButton`).
- Управлять режимом UI: «web» vs «telegram».

**Задачи**

1. Создать файл `composables/useTelegram.ts` с минимальным, но самодостаточным API:

   ```ts
   export function useTelegram() {
     const isClient = process.client
     const isTelegram = computed(() => {
       if (!isClient) return false
       // @ts-expect-error: Telegram WebApp может быть не объявлен
       return typeof window.Telegram !== 'undefined' && !!window.Telegram.WebApp?.initData
     })

     // Обёртка над window.Telegram.WebApp
     const webApp = computed(() => {
       if (!isClient) return null
       // @ts-expect-error
       return window.Telegram?.WebApp ?? null
     })

     // Управление MainButton
     function showMainButton(text: string) {
       if (!webApp.value) return
       webApp.value.MainButton.setText(text)
       webApp.value.MainButton.show()
     }

     function hideMainButton() {
       if (!webApp.value) return
       webApp.value.MainButton.hide()
     }

     function onMainButtonClick(handler: () => void) {
       if (!webApp.value) return
       webApp.value.onEvent('mainButtonClicked', handler)
     }

     return {
       isTelegram,
       webApp,
       showMainButton,
       hideMainButton,
       onMainButtonClick,
     }
   }
   ```

2. В корневом layout / `app.vue`:
   - использовать `useTelegram()` и `isTelegram` для условного рендера:
     - если `isTelegram` — **не показывать** стандартные Header/Footer и прочий «обвес» веб‑сайта;
     - если **не** `isTelegram` — показывать обычную шапку/подвал сайта.

3. Связать `useTelegram` с корзиной:
   - если `isTelegram === true` и в корзине `count > 0`:
     - показывать `MainButton` с текстом «Оформить заказ на X ₽»;
     - при `count === 0` скрывать `MainButton`;
   - в веб‑режиме (десктоп/мобильный браузер) оставить существующий UI (модалка корзины / отдельная страница).

---

### 2. Telegram Login Widget (Web‑аутентификация)

**Цели**

- На **внешнем сайте** (браузер, не Mini App) авторизовывать пользователя через официальный Telegram Login Widget.
- После успешной авторизации создать серверную сессию (JWT или http‑only cookie), чтобы знать, какой Telegram‑пользователь оформляет заказ.

**Задачи фронтенда**

1. Добавить универсальный компонент/кнопку «Войти через Telegram»:
   - показывать её:
     - в веб‑режиме (`isTelegram == false`);
     - при попытке оформить заказ, если нет активной сессии пользователя.
2. Вставить Telegram Login Widget:
   - либо через официальный `<script src="https://telegram.org/js/telegram-widget.js?22" ...>`;
   - либо через собственный обработчик, который получает `user` + `hash` и отправляет их на сервер.
3. После успешного логина:
   - отправить полученные данные (`id`, `first_name`, `username`, `auth_date`, `hash` и т.д.) POST‑запросом на `server/api/auth/telegram.post.ts`.

**Задачи бэкенда (`server/api/auth/telegram.post.ts`)**

1. Создать файл `server/api/auth/telegram.post.ts`.
2. Описание контракта:

   - **Вход**: JSON‑объект с полями от Telegram Login Widget:

     ```jsonc
     {
       "id": 123456789,
       "first_name": "User",
       "last_name": "Optional",
       "username": "nickname",
       "photo_url": "https://...",
       "auth_date": "1710000000",
       "hash": "..."
     }
     ```

   - **Выход**:
     - 200 OK + установка httpOnly cookie (например, `tg_session`);
     - либо 401 при неверной подписи / просроченном `auth_date`.

3. Логика валидации `hash` (по официальной схеме Telegram):

   - взять все поля, **кроме** `hash`;
   - отсортировать ключи по алфавиту;
   - собрать строки вида `key=value` и соединить через `\n`;
   - вычислить `secret_key = HMAC_SHA256(bot_token, "WebAppData")` **или** (для Login Widget) `secret_key = SHA256(bot_token)` — уточнить по актуальной документации;
   - вычислить `expected_hash = HMAC_SHA256(secret_key, data_check_string)`;
   - сравнить `expected_hash` с `hash` из запроса (в hex).

4. При успешной валидации:

   - создать payload для сессии, например:

     ```ts
     const user = {
       id: body.id,
       username: body.username,
       firstName: body.first_name,
       lastName: body.last_name ?? null,
       photoUrl: body.photo_url ?? null,
     }
     ```

   - либо:
     - подписать JWT (например, с `HS256` и секретом `NUXT_SESSION_SECRET`) и положить его в httpOnly cookie;
     - либо сохранить в server‑side store и положить только session‑id в cookie.

   - настроить cookie:

     - `httpOnly: true`
     - `secure: process.env.NODE_ENV === 'production'`
     - `sameSite: 'lax' | 'strict'` (по требованиям)
     - разумное `maxAge` (несколько дней / недель).

5. Добавить вспомогательный composable / util для чтения аутентифицированного пользователя в server‑роутах:

   - например, `server/utils/getTelegramUserFromEvent.ts`, который:
     - читает cookie;
     - декодирует JWT / ищет сессию;
     - возвращает `user` или `null`.

---

### 3. Завершение серверной логики заказов

**Цели**

- Довести до конца эндпоинты `server/api/order.post.ts` и `server/api/webhook.post.ts`.
- Учитывать два источника данных:
  - Telegram Mini App (initData);
  - Веб‑сайт с Telegram Login Widget (сессия из cookie).

**Задачи для `server/api/order.post.ts`**

1. **Контракт**:
   - Вход: JSON c
     - списком товаров (id, name, price, quantity);
     - суммой;
     - информацией о пользователе:
       - если TMA: распаковать initData Telegram WebApp на клиенте и переслать нужные поля;
       - если Web: взять пользователя из сессии (см. util выше).
2. **Валидация**:
   - Пересчитать итоговую сумму на сервере на основе товарного каталога (`MOCK_PRODUCTS` / будущий источник данных), чтобы не доверять фронту.
3. **Формирование сообщения менеджеру**:

   - Формат: номер заказа + список позиций + итоговая сумма + пользователь (username/id).
   - Создать `orderId` (например, короткий uuid / timestamp).
   - Сформировать callback_data вида `status_userId_orderId` (как в ТЗ).

4. **Отправка в Telegram**:

   - вызвать Telegram Bot API `sendMessage`:
     - `chat_id = NUXT_MANAGER_CHAT_ID`;
     - `text = ...` (подробности заказа);
     - `reply_markup.inline_keyboard` с первой кнопкой `[Принять в работу]`, где `callback_data = work_<userId>_<orderId>`.

5. **Ответ фронту**:

   - вернуть 200 OK + краткую информацию об успешно созданном заказе (orderId и т.п.).

**Задачи для `server/api/webhook.post.ts`**

1. Обработать два основных типа апдейтов:

   - `message` (команды `/start`, `/help`);
   - `callback_query` (инлайн‑кнопки менеджера).

2. `/start`:

   - отправить приветственное сообщение пользователю с кнопкой WebApp `Открыть магазин`.

3. `callback_query`:

   - распарсить `callback_data = status_userId_orderId`;
   - по `status`:
     - `work` → поменять текст и кнопки на `[Передать курьеру]`, отправить пользователю уведомление;
     - `courier` → заменить на `[Доставлен]`, отправить уведомление пользователю;
     - `done` → убрать кнопки, пометить заказ как завершённый, отправить финальное уведомление.

4. Всегда вызывать `answerCallbackQuery` после обработки, чтобы убрать «часики» у менеджера.

5. (Опционально, но желательно) логи:

   - Простая логика логирования апдейтов в файлы/консоль, чтобы проще было отлаживать прод.

---

### 4. Разделение поведения Web / Telegram в оформлении заказа

**В вебе (не TMA)**:

- При нажатии на «Оформить заказ» в корзине:
  - если пользователь **не авторизован через Telegram Login Widget**:
    - показать модалку / редирект с предложением «Войти через Telegram»;
    - после успешного логина повторно инициировать заказ.
  - если авторизован:
    - отправить заказ на `POST /api/order` вместе с информацией из сессии.

**В Telegram Mini App**:

- Использовать `MainButton`:
  - текст: «Оформить заказ на X ₽»;
  - клик:
    - собрать корзину;
    - добавить данные пользователя из `initData` WebApp (user id, username, etc.);
    - отправить на `POST /api/order`.

---

### 5. Безопасность и тестирование

1. **Безопасность**:
   - не доверять сумме и ценам, пришедшим от клиента;
   - валидировать все поля заказов и auth‑payload;
   - держать `NUXT_BOT_TOKEN` и (при необходимости) `NUXT_SESSION_SECRET` только в env‑переменных.

2. **Тесты / проверки**:
   - ручной прогон сценариев:
     - Mini App: заказ создаётся, менеджеру падает сообщение, статусы меняются по цепочке;
     - Web: login через Telegram, заказ, уведомления менеджеру и клиенту.
   - (Опционально) Автотесты для:
     - `auth/telegram.post.ts` (валидный и невалидный hash);
     - `order.post.ts` (пересчёт суммы, формирование сообщения менеджеру).

