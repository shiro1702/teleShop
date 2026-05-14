# План деплоя TeleShop на REG.RU (Nuxt + Nitro + Supabase + CI/CD)

## Цель
Настроить стабильный деплой сайта-приложения на REG.RU с двумя окружениями:
- `main` -> pretest (`pocketmenu.online`);
- `production` -> прод (`pocketmenu.ru`).

Параллельно настроить CI/CD, чтобы при пуше в нужную ветку код автоматически подтягивался на сервер, пересобирался и перезапускался без ручных действий.

---

## 1) Текущее состояние (что уже сделано)

- Поднят VPS на REG.RU (Ubuntu `24.04.3 LTS`).
- Настроены Docker Engine + Docker Compose plugin.
- Настроены Nginx и UFW (`OpenSSH`, `Nginx Full`).
- Созданы каталоги окружений:
  - `/opt/tele-shop/pretest/app`
  - `/opt/tele-shop/prod/app`
- Созданы серверные env-файлы:
  - `/opt/tele-shop/pretest/.env.pretest`
  - `/opt/tele-shop/prod/.env.prod`
- В репозитории добавлены:
  - `Dockerfile`, `.dockerignore`
  - `docker-compose.pretest.yml`, `docker-compose.prod.yml`
  - `.github/workflows/deploy-pretest.yml`, `.github/workflows/deploy-production.yml`
- Nginx маршрутизация настроена:
  - `pocketmenu.online` / `www.pocketmenu.online` -> `127.0.0.1:3001` (pretest)
  - `pocketmenu.ru` / `www.pocketmenu.ru` -> `127.0.0.1:3000` (prod)

---

## 2) Архитектура окружений

## Ветка -> окружение
- `main` -> `pocketmenu.online`
- `production` -> `pocketmenu.ru`

## Изоляция pretest/prod
- отдельные каталоги на сервере;
- отдельные compose-файлы;
- отдельные env-файлы;
- отдельные порты (`3001`/`3000`);
- отдельные секреты и ключи API.

---

## 3) CI/CD (GitHub Actions)

## 3.1. Сценарий деплоя
При пуше на один и тот же VPS:
- `main` -> деплой pretest;
- `production` -> деплой prod.

Принцип по ресурсам (актуально при self-hosted Supabase на том же VPS):
- сборка приложения выполняется в GitHub Actions;
- на VPS выполняется только запуск/перезапуск контейнеров;
- это снижает риск просадки памяти и деградации БД во время `npm run build`.

Pipeline:
1. checkout
2. `npm ci && npm run build` (проверка сборки)
3. SSH на сервер
4. sync нужной ветки в `DEPLOY_PATH`
5. запись серверного env из GitHub Secret (`PRETEST_ENV_FILE` / `PROD_ENV_FILE`)
6. `docker compose ... build --pull`
7. `docker compose ... up -d --remove-orphans`
8. `docker image prune -f`

## 3.2. Актуальные GitHub Secrets

Общие:
- `SSH_PRIVATE_KEY`
- `SSH_USER`
- `VPS_HOST`

Pretest:
- `PRETEST_DEPLOY_PATH` (рекомендуется `/opt/tele-shop/pretest/app`)
- `PRETEST_ENV_FILE` (полный текст env для pretest)

Prod:
- `PROD_DEPLOY_PATH` (рекомендуется `/opt/tele-shop/prod/app`)
- `PROD_ENV_FILE` (полный текст env для prod)

## 3.3. Защита production
- branch protection для `production`;
- merge через PR (без прямого push);
- по возможности required reviewers;
- environment protection rule на workflow production.

---

## 4) Nginx + SSL

До выпуска сертификатов:
- домены должны резолвиться в IP VPS (`168.222.194.186`).

После обновления DNS:
- выпустить сертификаты через certbot для:
  - `pocketmenu.online`, `www.pocketmenu.online`
  - `pocketmenu.ru`, `www.pocketmenu.ru`

Примечание: Telegram Mini Apps и современные браузеры требуют HTTPS, поэтому для боевого запуска SSL обязателен.

---

## 5) Supabase стратегия (два варианта)

## Self-hosted Supabase на VPS (из заметок Gemini)
Подходит, если нужен полный контроль данных и локализация ПДн в РФ.

Минимальные ресурсы для self-hosted:
- 4 vCPU
- 8 GB RAM
- SSD от 40 GB (лучше 80+ GB с запасом)

Общий контур:
1. Клонировать официальный репозиторий Supabase (`supabase/docker`).
2. Подготовить `.env` Supabase и обязательно задать новые:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `ANON_KEY`
   - `SERVICE_ROLE_KEY`
   - `SITE_URL`
3. Поднять стек `docker compose up -d`.
4. Настроить Nginx + HTTPS для API/Studio.
5. Перенести данные:
   - dump/restore PostgreSQL (`pg_dump` / `pg_restore`)
   - отдельно перенести объекты Storage (бакеты и файлы)
6. Переключить `SUPABASE_URL` и ключи в env приложения.

Текущее решение по домену:
- DNS уже заведен: `api -> 168.222.194.186`
- целевой endpoint для приложения: `https://api.pocketmenu.online`
- подробный runbook: `docs/runbooks/DEPLOY_SERVER_REGRU_SINGLE_VPS.md` (раздел `Supabase на том же VPS`)

Подводные камни:
- обязательно HTTPS (иначе Mini Apps могут не работать);
- нужен SMTP для email-сценариев auth;
- нужны регулярные бэкапы и тест восстановления.

## 5.1. Миграция с Supabase Cloud на self-hosted (рекомендуемый порядок)

1. Поднять self-hosted Supabase и проверить API/Studio.
2. Сделать дамп облачной БД (`pg_dump`) и восстановить в self-hosted (`pg_restore`).
3. Перенести Storage:
   - создать те же bucket'ы;
   - перенести файлы (через Studio или скрипт).
4. Обновить env приложения:
   - `SUPABASE_URL=https://api.pocketmenu.online`
   - `SUPABASE_KEY=<ANON_KEY self-hosted>`
   - `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY self-hosted>`
5. Перезапустить pretest, прогнать smoke/UAT.
6. После проверки переключить production.

---

## 6) Пошаговый план внедрения (обновленный)

1. Проверить DNS на оба домена (`pocketmenu.online`, `pocketmenu.ru`) -> IP VPS.
2. Выпустить SSL на оба домена.
3. Проверить ручной запуск pretest/prod compose на сервере.
4. Заполнить GitHub Secrets (`*_ENV_FILE`, SSH, пути деплоя).
5. Запустить pretest workflow (`main`) и пройти smoke/UAT.
6. Включить branch protection для `production`.
7. Запустить production workflow.
8. Определиться со стратегией Supabase:
   - оставить Cloud;
   - или отдельным этапом мигрировать на self-hosted.

---

## 7) Чеклист готовности к продакшену

- [ ] DNS обоих доменов указывает на VPS.
- [ ] SSL сертификаты выпущены и автообновляются.
- [ ] Pretest и prod используют разные env и секреты.
- [ ] Для `production` запрещены прямые push.
- [ ] Настроены мониторинг логов (`docker logs` + внешний мониторинг/алерты).
- [ ] Описан rollback.
- [ ] Для выбранного варианта Supabase есть бэкапы и план восстановления.

---

## 8) Rollback (короткая инструкция)

Если релиз сломал прод:
1. На сервере перейти в каталог `/opt/tele-shop/prod/app`.
2. `git log --oneline` и выбрать предыдущий стабильный commit.
3. `git checkout <stable_commit>`
4. `docker compose -f docker-compose.prod.yml build --no-cache`
5. `docker compose -f docker-compose.prod.yml up -d`
6. Проверить ключевые страницы и API.

После стабилизации:
- вернуть рабочее состояние ветки `production` в репозитории;
- зафиксировать hotfix отдельным PR.
