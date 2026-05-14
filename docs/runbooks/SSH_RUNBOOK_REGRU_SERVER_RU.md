# SSH RUNBOOK: работа с сервером TeleShop (REG.RU)

Короткий рабочий документ для ежедневной работы с VPS по SSH: подключение, ключи, базовые операции, диагностика и безопасность.

## 1) Параметры сервера

- Host: `168.222.194.186`
- User: `root`
- Основной ключ: `~/.ssh/id_ed25519-friday`

Подключение:

```bash
ssh -i ~/.ssh/id_ed25519-friday root@168.222.194.186
```

---

## 2) Быстрая настройка удобного alias

Добавить в локальный `~/.ssh/config`:

```sshconfig
Host teleshop-vps
  HostName 168.222.194.186
  User root
  IdentityFile ~/.ssh/id_ed25519-friday
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 6
```

После этого подключение одной командой:

```bash
ssh teleshop-vps
```

---

## 3) Проверка доступа и состояния после входа

```bash
whoami
hostname
uptime
df -h
free -h
docker ps
systemctl is-active nginx docker
```

---

## 4) Основные рабочие каталоги на сервере

- Pretest: `/opt/tele-shop/pretest/app`
- Prod: `/opt/tele-shop/prod/app`
- Env pretest: `/opt/tele-shop/pretest/.env.pretest`
- Env prod: `/opt/tele-shop/prod/.env.prod`
- Nginx config: `/etc/nginx/sites-available/tele-shop.conf`

---

## 5) Частые SSH-команды для администрирования

Проверка прав ключей у root:

```bash
ls -la /root/.ssh
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

Добавить новый публичный ключ:

```bash
cat >> /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAA... ваш_публичный_ключ ... comment
EOF
chmod 600 /root/.ssh/authorized_keys
```

---

## 6) Деплой/рестарт с сервера вручную (по SSH)

### Pretest (`main`)

```bash
cd /opt/tele-shop/pretest/app
git fetch origin main
git checkout main
git reset --hard origin/main
docker compose -f docker-compose.pretest.yml up -d --build --remove-orphans
docker logs --tail=100 tele-shop-pretest
```

### Prod (`production`)

```bash
cd /opt/tele-shop/prod/app
git fetch origin production
git checkout production
git reset --hard origin/production
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker logs --tail=100 tele-shop-prod
```

---

## 7) Диагностика SSH-проблем

### Ошибка `Permission denied (publickey,password)`

Проверить:
- правильный пользователь (`root`);
- правильный приватный ключ (`-i ~/.ssh/id_ed25519-friday`);
- ключ добавлен на сервер в `/root/.ssh/authorized_keys`;
- права на `.ssh` и `authorized_keys` (`700` / `600`);
- нет ли лишних пробелов/переносов в публичном ключе.

Локальная диагностика:

```bash
ssh -vvv -i ~/.ssh/id_ed25519-friday root@168.222.194.186
```

### Если ключ не пускает, но пароль работает

1. Зайти по паролю в консоль/VNC.
2. Добавить публичный ключ в `authorized_keys`.
3. Проверить права файлов.
4. Повторить вход по ключу.

---

## 8) Безопасность SSH (рекомендуемый минимум)

После проверки, что вход по ключу стабилен:

1. Сменить пароль `root`.
2. Отключить парольный вход в SSH.
3. Оставить доступ только по ключам.

Проверка UFW:

```bash
ufw status
```

Должно быть открыто минимум:
- `OpenSSH`
- `Nginx Full`

---

## 9) Полезные one-liners с локальной машины

Проверить доступ:

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519-friday root@168.222.194.186 "echo ok"
```

Передать файл на сервер:

```bash
scp -i ~/.ssh/id_ed25519-friday ./local.file root@168.222.194.186:/root/
```

Забрать файл с сервера:

```bash
scp -i ~/.ssh/id_ed25519-friday root@168.222.194.186:/root/remote.file ./remote.file
```

---

## 10) Ссылки на смежные документы

- Общий runbook деплоя: `docs/runbooks/DEPLOY_SERVER_REGRU_SINGLE_VPS.md`
- Архитектурный план: `docs/runbooks/REGRU_DEPLOY_NUXT_NITRO_SUPABASE_CICD_PLAN_RU.md`
