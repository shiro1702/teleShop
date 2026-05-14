# DEPLOY SERVER RUNBOOK (REG.RU, single VPS)

Практическая инструкция для запуска `teleShop` на одном VPS с двумя окружениями:
- `pretest` (`main`) -> `pocketmenu.online`
- `prod` (`production`) -> `pocketmenu.ru`

## 0) Предпосылки

- VPS: Ubuntu `24.04` (или `22.04`).
- Доступ по SSH с ключом.
- Репозиторий доступен с сервера.
- В DNS готовы A-записи:
  - `pocketmenu.online` -> `SERVER_IP`
  - `www.pocketmenu.online` -> `SERVER_IP`
  - `pocketmenu.ru` -> `SERVER_IP`
  - `www.pocketmenu.ru` -> `SERVER_IP`
  - `api.pocketmenu.online` -> `SERVER_IP`

---

## 1) Базовая подготовка сервера

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release git nginx certbot python3-certbot-nginx ufw
```

### Docker Engine + Compose plugin

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверка:

```bash
docker --version
docker compose version
systemctl is-active docker
```

---

## 2) Структура каталогов

```bash
mkdir -p /opt/tele-shop/pretest/app
mkdir -p /opt/tele-shop/prod/app
touch /opt/tele-shop/pretest/.env.pretest
touch /opt/tele-shop/prod/.env.prod
chmod 600 /opt/tele-shop/pretest/.env.pretest /opt/tele-shop/prod/.env.prod
```

---

## 3) Nginx (reverse proxy)

Создать `/etc/nginx/sites-available/tele-shop.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name pocketmenu.ru www.pocketmenu.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name pocketmenu.online www.pocketmenu.online;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активировать:

```bash
ln -sf /etc/nginx/sites-available/tele-shop.conf /etc/nginx/sites-enabled/tele-shop.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 4) Firewall (UFW)

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable
ufw status
```

---

## 5) SSL (Let's Encrypt)

После того как DNS указывает на сервер:

```bash
certbot --nginx -d pocketmenu.online -d www.pocketmenu.online -d pocketmenu.ru -d www.pocketmenu.ru
```

Проверка автообновления:

```bash
systemctl status certbot.timer
certbot renew --dry-run
```

---

## 6) Что должно быть в репозитории

- `Dockerfile`
- `.dockerignore`
- `docker-compose.pretest.yml`
- `docker-compose.prod.yml`
- `.github/workflows/deploy-pretest.yml`
- `.github/workflows/deploy-production.yml`

`docker-compose.pretest.yml` должен читать `../.env.pretest`,  
`docker-compose.prod.yml` должен читать `../.env.prod`.

---

## 7) Первый ручной деплой (до CI/CD)

### Pretest

```bash
cd /opt/tele-shop/pretest/app
git clone <REPO_URL> . || true
git fetch origin main
git checkout main
git reset --hard origin/main
docker compose -f docker-compose.pretest.yml build --pull
docker compose -f docker-compose.pretest.yml up -d --remove-orphans
```

### Prod

```bash
cd /opt/tele-shop/prod/app
git clone <REPO_URL> . || true
git fetch origin production
git checkout production
git reset --hard origin/production
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## 8) GitHub Secrets для авто-деплоя

Общие:
- `SSH_PRIVATE_KEY`
- `SSH_USER`
- `VPS_HOST`

Pretest:
- `PRETEST_DEPLOY_PATH=/opt/tele-shop/pretest/app`
- `PRETEST_ENV_FILE` (полный текст env для pretest)

Prod:
- `PROD_DEPLOY_PATH=/opt/tele-shop/prod/app`
- `PROD_ENV_FILE` (полный текст env для prod)

Примечание по производительности:
- при self-hosted Supabase на том же сервере не рекомендуется собирать Nuxt на VPS;
- сборка выполняется в GitHub Actions, VPS получает уже готовый артефакт/код и только запускает контейнеры.

---

## 9) Проверка работоспособности

```bash
docker ps
docker logs --tail=100 tele-shop-pretest
docker logs --tail=100 tele-shop-prod
curl -I http://127.0.0.1:3001
curl -I http://127.0.0.1:3000
```

Снаружи:
- `https://pocketmenu.online`
- `https://pocketmenu.ru`

---

## 10) Rollback (prod)

```bash
cd /opt/tele-shop/prod/app
git log --oneline
git checkout <stable_commit>
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

После стабилизации вернуть `production` в согласованное состояние через PR/hotfix.

---

## 11) Supabase на том же VPS (self-hosted, subdomain `api`)

Если уже создана DNS-запись `A api -> 168.222.194.186`, можно поднять Supabase на этом же сервере.

Рекомендуемый публичный URL:
- `https://api.pocketmenu.online`

### 11.1. Подготовить каталог и скачать self-hosted стек

```bash
mkdir -p /opt/supabase
cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
cp .env.example .env
```

### 11.2. Обязательные параметры в `/opt/supabase/supabase/docker/.env`

Изменить значения по умолчанию (сильные уникальные секреты):
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `SITE_URL=https://api.pocketmenu.online`

Дополнительно проверить:
- `API_EXTERNAL_URL=https://api.pocketmenu.online`
- SMTP-параметры (если нужен email auth).

### 11.3. Запуск Supabase

```bash
cd /opt/supabase/supabase/docker
docker compose pull
docker compose up -d
docker compose ps
```

### 11.4. Nginx-прокси для `api.pocketmenu.online`

Добавить в `/etc/nginx/sites-available/tele-shop.conf` отдельный server block:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.pocketmenu.online;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Применить:

```bash
nginx -t
systemctl reload nginx
```

### 11.5. SSL для API поддомена

```bash
certbot --nginx -d api.pocketmenu.online
```

### 11.6. Подключить teleShop к новому Supabase

В env приложения (pretest/prod) заменить:
- `SUPABASE_URL=https://api.pocketmenu.online`
- `SUPABASE_KEY=<новый ANON_KEY>`
- `SUPABASE_SERVICE_ROLE_KEY=<новый SERVICE_ROLE_KEY>`

После изменения env перезапустить стеки приложения.

### 11.7. Минимум по эксплуатации

- ежедневный backup Postgres (cron + `pg_dump` в отдельное хранилище);
- тест восстановления хотя бы 1 раз в месяц;
- обновления Supabase только после теста на pretest;
- не публиковать внутренние порты БД наружу.

### 11.8. Миграция данных из Supabase Cloud

Минимальный сценарий:
1. сделать dump облачной БД (`pg_dump`);
2. восстановить dump в self-hosted (`pg_restore`);
3. перенести Storage (bucket'ы и файлы);
4. переключить `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` в env приложения;
5. перезапустить pretest, проверить сценарии заказа/авторизации, затем переключать prod.
