# SELF-HOSTED SUPABASE RUNBOOK (prod on pocketmenu.ru)

Практический документ по эксплуатации self-hosted Supabase для `prod`.

## 1. Текущая схема

- Supabase развернут на VPS в каталоге `/opt/supabase/supabase/docker`.
- Публичный API endpoint: `https://api.pocketmenu.ru`.
- `prod` приложения (`pocketmenu.ru`) смотрит в self-hosted Supabase.
- `pretest` остается на Supabase Cloud.

## 2. Где что лежит

- Supabase compose: `/opt/supabase/supabase/docker/docker-compose.yml`
- Supabase env: `/opt/supabase/supabase/docker/.env`
- Миграции проекта (локально): `supabase/migrations`
- Prod env приложения:
  - `/opt/tele-shop/prod/.env.prod`
  - `/opt/tele-shop/prod/app/.env`

## 3. Проверка состояния

На сервере:

```bash
cd /opt/supabase/supabase/docker
docker compose ps
```

Проверка API (ожидаем 401 без apikey):

```bash
curl -I https://api.pocketmenu.ru/rest/v1/
```

Проверка prod приложения:

```bash
curl -I https://pocketmenu.ru
```

## 4. Перезапуск и обновление

Полный рестарт Supabase:

```bash
cd /opt/supabase/supabase/docker
docker compose up -d
```

Обновление образов:

```bash
cd /opt/supabase/supabase/docker
docker compose pull
docker compose up -d
```

Логи ключевых сервисов:

```bash
docker logs --tail=200 supabase-kong
docker logs --tail=200 supabase-db
docker logs --tail=200 supabase-auth
```

## 5. Сетевой доступ и безопасность

Публично доступен только `api.pocketmenu.ru` через Nginx -> Kong (`127.0.0.1:8000`).

Порты Supabase ограничены localhost:

- `127.0.0.1:8000` (Kong HTTP)
- `127.0.0.1:8443` (Kong HTTPS)
- `127.0.0.1:5432` (DB/pooler local only)
- `127.0.0.1:6543` (pooler)

Проверка:

```bash
ss -tulpn | awk '/:8000|:8443|:5432|:6543/ {print}'
```

## 6. Ключи/доступы (что использовать)

Для приложения:

- `SUPABASE_URL=https://api.pocketmenu.ru`
- `SUPABASE_KEY=<ANON_KEY из /opt/supabase/supabase/docker/.env>`
- `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY из /opt/supabase/supabase/docker/.env>`

Для Nuxt public runtime:

- `NUXT_PUBLIC_SUPABASE_URL=https://api.pocketmenu.ru`
- `NUXT_PUBLIC_SUPABASE_KEY=<ANON_KEY>`

Важно: после смены ключей в `.env` Supabase надо обновить `.env.prod` и `/opt/tele-shop/prod/app/.env`, затем перезапустить prod контейнер.

## 7. Миграции

Структура уже подготовлена и миграции проекта применены в self-hosted БД.

### 7.1. Синхронизация с репозиторием по SSH (рекомендуется)

На **локальной** машине (где есть репозиторий `teleShop` и SSH-ключ до VPS, см. `docs/runbooks/SSH_RUNBOOK_REGRU_SERVER_RU.md`):

```bash
cd /path/to/teleShop
./scripts/apply-selfhosted-supabase-migrations.sh
```

Просмотр без применения:

```bash
./scripts/apply-selfhosted-supabase-migrations.sh --dry-run
```

Скрипт читает `supabase_migrations.schema_migrations` на сервере, сравнивает с файлами `supabase/migrations/*.sql` (имя без `.sql` = поле `version`) и через `docker exec -i supabase-db psql` применяет только отсутствующие файлы по порядку, затем добавляет строку в `schema_migrations`.

Переменные при необходимости: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `REMOTE_SUPABASE_DOCKER`. Если список миграций из БД пустой, скрипт **останавливается** (защита от повторного наката `001_*`); осознанный первый прогон: `FORCE_EMPTY_APPLIED_LIST=1 ./scripts/apply-selfhosted-supabase-migrations.sh`.

После DDL, если API отдаёт старую схему (кэш PostgREST), перезапусти сервис REST в compose (имя контейнера/сервиса смотри `docker compose ps` в каталоге Supabase), например:

```bash
cd /opt/supabase/supabase/docker
docker compose restart rest
```

### 7.2. Одна миграция вручную на сервере

Если нужно применять одну миграцию вручную:

```bash
cd /opt/supabase/supabase/docker
export PGPASSWORD="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env | head -n1)"
docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < /path/to/migration.sql
```

## 8. Бэкап (минимум)

Ручной бэкап:

```bash
cd /opt/supabase/supabase/docker
export PGPASSWORD="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env | head -n1)"
docker exec -i supabase-db pg_dump -U postgres -d postgres -Fc > /root/supabase_$(date +%F_%H-%M).dump
```

Проверка восстановления (рекомендуется в отдельной БД/инстансе).

## 9. Что обязательно сменить после запуска

- `DASHBOARD_PASSWORD` в `/opt/supabase/supabase/docker/.env` (сейчас дефолтный/небезопасный).
- При необходимости `DASHBOARD_USERNAME`.

После смены:

```bash
cd /opt/supabase/supabase/docker
docker compose up -d
```
Для Studio/Dashboard basic auth сейчас:
логин: supabase
пароль: this_password_is_insecure_and_should_be_updated