# UI UX Pro Max Skill: документация и как использовать

Документ описывает практическое применение `ui-ux-pro-max-skill` в проекте TeleShop: что делает скилл, как установить, какие команды запускать и как встроить в текущий workflow.

---

## 1. Что это за скилл

`UI UX Pro Max` — это AI-скилл для генерации UI/UX-решений:

- подбирает визуальный стиль под тип продукта;
- предлагает цвета, типографику, паттерны экранов и взаимодействий;
- помогает формировать дизайн-систему (master + page overrides);
- дает рекомендации по разным стекам (в т.ч. Vue/Nuxt).

Смысл для команды: быстрее получать согласованные UI-решения и уменьшать "рандом" в визуале между экранами.

Источник: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)

---

## 2. Когда полезен в TeleShop

Используйте скилл, когда нужно:

- проектировать новые dashboard-экраны;
- выровнять визуальный язык между `admin`, `owner`, `staff` зонами;
- быстро подготовить UI-концепт перед реализацией в Nuxt;
- получить чеклист UX/доступности перед финализацией.

Особенно полезен для: onboarding, settings, billing, analytics, checkout-экраны.

---

## 3. Установка

### 3.1. Через Claude Marketplace (если используете Claude Code)

```bash
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

### 3.2. Через CLI (универсально, в т.ч. для Cursor)

```bash
npm install -g uipro-cli
cd /path/to/your/project
uipro init --ai cursor
```

Глобальная установка (для всех проектов):

```bash
uipro init --ai cursor --global
```

---

## 4. Быстрый старт использования

После установки обычно достаточно обычного запроса в чате:

- "Сделай дизайн dashboard для SaaS-аналитики в стиле minimal + data-dense"
- "Нужен экран биллинга для ресторана, light theme, акцент на читаемость"
- "Собери дизайн-систему для TeleShop и предложи компоненты для Nuxt UI"

Если runtime требует slash-команды, используйте:

```bash
/ui-ux-pro-max <ваш запрос>
```

---

## 5. Рекомендуемый workflow для команды

1. Сформулировать задачу экрана (цель + роль пользователя + KPI экрана).
2. Сгенерировать базовую дизайн-систему через скилл.
3. Зафиксировать результат в документе/артефакте проекта.
4. Реализовать UI в Nuxt.
5. Пройти чеклист доступности и UX перед merge.

Короткий шаблон запроса для стабильного результата:

"Сделай UI-концепт для [экран] в продукте [тип продукта].
Стек: Nuxt 3 + Vue 3.
Приоритет: [читаемость/конверсия/плотность данных].
Ограничения: [light-only, AA contrast, mobile-first].
Верни: layout, palette, typography, components, interaction states."

---

## 6. Продвинутый режим: генерация дизайн-системы из скрипта

Если скилл установлен локально как Claude/Cursor skill, можно использовать встроенный `search.py`.

Пример генерации дизайн-системы:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "restaurant saas dashboard" --design-system -p "TeleShop"
```

Markdown-формат:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "restaurant saas dashboard" --design-system -f markdown
```

> Примечание: путь к папке скилла зависит от runtime (`.claude/skills` / `.cursor/skills` и т.д.).

---

## 7. Master + Page Overrides (рекомендуется)

Скилл поддерживает модель:

- `design-system/MASTER.md` — глобальные правила;
- `design-system/pages/<page>.md` — частные правила конкретной страницы.

Это удобно для TeleShop, где базовый стиль общий, а экранные правила отличаются (например, `dashboard`, `billing`, `checkout`).

Пример генерации с сохранением:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "SaaS dashboard" --design-system --persist -p "TeleShop"
```

С override для страницы:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "SaaS dashboard" --design-system --persist -p "TeleShop" --page "dashboard"
```

---

## 8. Практические правила качества

- Держать контраст текста не ниже WCAG AA.
- Проверять состояния `hover`, `focus`, `disabled`, `error`, `loading`.
- Не смешивать в одном релизе более 1-2 визуальных стилей.
- Для таблиц/аналитики предпочитать читаемость и иерархию, а не декоративность.
- Все кликабельные элементы должны быть явно распознаваемы.

---

## 9. Ограничения и риски

- Скилл дает рекомендации, но финальные решения по бренду и UX остаются за командой.
- Для критичных потоков (оплата, авторизация, роли) UX нужно проверять на реальных сценариях.
- Визуально эффектные стили (glassmorphism, brutalism и т.п.) нужно применять умеренно в SaaS-панелях.

---

## 10. Полезные команды

```bash
uipro versions
uipro update
uipro uninstall
```

Проверка Python:

```bash
python3 --version
```

---

## 11. Рекомендуемый сценарий именно для TeleShop

1. Зафиксировать базовый стиль продукта (1 стиль + 1 fallback).
2. Сгенерировать `MASTER.md` для dashboard-платформы.
3. Сделать page overrides для:
   - `dashboard`,
   - `billing`,
   - `checkout`,
   - `settings`.
4. На каждый новый экран сначала сверяться с `MASTER.md`, потом с page override.

Это дает единый UX-язык и уменьшает количество правок после code review.

