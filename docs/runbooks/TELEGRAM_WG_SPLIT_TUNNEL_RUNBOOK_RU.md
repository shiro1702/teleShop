# RUNBOOK: WireGuard только для Telegram API (split tunnel)

Документ фиксирует:
- что уже диагностировано по проблеме Telegram webhook;
- что нужно сделать, чтобы трафик к `api.telegram.org` шел через WireGuard/VPN;
- как оставить остальной прод-трафик без изменений.

---

## 1) Что уже сделано и подтверждено

### 1.1 Проверка webhook у Telegram

- Выполнен `setWebhook` для бота на `https://pocketmenu.ru/api/webhook`.
- Ответ Telegram: webhook уже установлен.
- `getWebhookInfo` показывает:
  - `url=https://pocketmenu.ru/api/webhook`
  - есть `pending_update_count`
  - `last_error_message`: `Connection timed out`

### 1.2 Проверка доступности endpoint снаружи

- `GET https://pocketmenu.ru/api/webhook` отвечает `200`.
- Тестовый `POST` на endpoint давал `500` до fail-safe обработки.

### 1.3 Проверка логов прод-сервера

В логах `tele-shop-prod` было:
- `[request error] [unhandled] [POST] https://pocketmenu.ru/api/webhook`
- `TypeError: fetch failed`
- `cause: ETIMEDOUT`
- стек внутри `server/api/webhook.post.ts` при вызове Telegram API.

Вывод: webhook до сервера доходит, но исходящие запросы с VPS в Telegram API таймаутятся.

### 1.4 Сетевой диагноз с VPS `168.222.194.186`

- `https://api.telegram.org` (IPv4): timeout (`HTTP 000`).
- `https://api.telegram.org/bot<token>/getMe` (IPv4): timeout.
- Общий интернет с VPS работает:
  - `https://www.google.com` -> `200`
  - `https://cloudflare.com` -> `301`

Итог: проблема селективная по маршруту к Telegram API, а не общий outage сервера.

### 1.5 Уже внесенное защитное изменение в код

В `server/api/webhook.post.ts` добавлен fail-safe `try/catch` вокруг основного handler:
- при внутренней ошибке webhook теперь возвращает `{ ok: true }`, чтобы Telegram не зацикливал ретраи из-за `500`.

Важно: это смягчает симптом (`500`), но не лечит сетевую недоступность Telegram API с VPS.

---

## 2) Цель решения

Сделать так, чтобы:
- **только** трафик к Telegram API шел через WireGuard туннель;
- остальной трафик (`Supabase`, сайты, внешние API, nginx и т.д.) шел по обычному маршруту VPS.

Да, это реализуемо через policy routing + ipset.

---

## 3) Что нужно от вас (минимум)

Нужен внешний VPS вне RU-блокировок (например, NL/DE/FI):
- публичный IP внешнего VPS (пример: `203.0.113.10`);
- SSH-доступ `root` на него;
- открыть UDP порт WireGuard (обычно `51820/udp`).

Если дадите доступ к внешнему VPS, настройку можно выполнить полностью.

---

## 4) Схема

- REG.RU VPS (`168.222.194.186`) = WireGuard **client**
- External VPS (EU) = WireGuard **server**
- На REG.RU:
  - домены Telegram (`api.telegram.org`) резолвятся в IP;
  - IP кладутся в `ipset` `telegram_api`;
  - `iptables mangle` маркирует пакеты к этим IP;
  - `ip rule` отправляет маркированные пакеты в routing table `100`;
  - table `100` использует default route через `wg0`.

Остальной трафик не маркируется -> идет по обычной default route.

---

## 5) Настройка WireGuard (пошагово)

## 5.1 External VPS (WG server)

Установка:

```bash
apt update
apt install -y wireguard
umask 077
wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub
```

`/etc/wireguard/wg0.conf` (пример):

```ini
[Interface]
Address = 10.66.66.1/24
ListenPort = 51820
PrivateKey = <SERVER_PRIVATE_KEY>

# NAT для выхода клиента в интернет через внешний VPS
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -t nat -A POSTROUTING -s 10.66.66.0/24 -o eth0 -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -s 10.66.66.0/24 -o eth0 -j MASQUERADE

[Peer]
PublicKey = <REGRU_CLIENT_PUBLIC_KEY>
AllowedIPs = 10.66.66.2/32
```

Запуск:

```bash
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0
wg show
```

---

## 5.2 REG.RU VPS (WG client)

Установка и ключи:

```bash
apt update
apt install -y wireguard ipset iptables dnsutils
umask 077
wg genkey | tee /etc/wireguard/client.key | wg pubkey > /etc/wireguard/client.pub
```

`/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = 10.66.66.2/24
PrivateKey = <CLIENT_PRIVATE_KEY>

[Peer]
PublicKey = <SERVER_PUBLIC_KEY>
Endpoint = <EXTERNAL_VPS_IP>:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

Поднять интерфейс:

```bash
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0
wg show
```

---

## 5.3 Split-tunnel только для Telegram

Добавить routing table:

```bash
grep -q '^100 telegramwg$' /etc/iproute2/rt_tables || echo '100 telegramwg' >> /etc/iproute2/rt_tables
```

Создать ipset и наполнить IP Telegram API:

```bash
ipset create telegram_api hash:ip -exist
for ip in $(dig +short A api.telegram.org); do ipset add telegram_api "$ip" -exist; done
```

Маркировка пакетов к Telegram API:

```bash
iptables -t mangle -A OUTPUT -p tcp -m set --match-set telegram_api dst -j MARK --set-mark 0x66
```

Policy routing для mark `0x66`:

```bash
ip rule add fwmark 0x66 table telegramwg priority 10066
ip route add default dev wg0 table telegramwg
```

Проверка:

```bash
ip rule show
ip route show table telegramwg
ipset list telegram_api
```

---

## 5.4 Автообновление IP Telegram (важно)

`api.telegram.org` может менять IP, поэтому нужен refresh.

Скрипт `/usr/local/bin/refresh-telegram-ipset.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

TMP_SET="telegram_api_tmp"
MAIN_SET="telegram_api"

ipset create "$TMP_SET" hash:ip -exist
ipset flush "$TMP_SET"

for ip in $(dig +short A api.telegram.org); do
  ipset add "$TMP_SET" "$ip" -exist
done

ipset create "$MAIN_SET" hash:ip -exist
ipset swap "$TMP_SET" "$MAIN_SET"
ipset destroy "$TMP_SET" || true
```

Права:

```bash
chmod +x /usr/local/bin/refresh-telegram-ipset.sh
```

systemd unit `/etc/systemd/system/telegram-ipset-refresh.service`:

```ini
[Unit]
Description=Refresh Telegram API ipset
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/refresh-telegram-ipset.sh
```

timer `/etc/systemd/system/telegram-ipset-refresh.timer`:

```ini
[Unit]
Description=Refresh Telegram API ipset every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=telegram-ipset-refresh.service

[Install]
WantedBy=timers.target
```

Запуск:

```bash
systemctl daemon-reload
systemctl enable --now telegram-ipset-refresh.timer
systemctl start telegram-ipset-refresh.service
```

---

## 6) Проверки после настройки

С REG.RU VPS:

```bash
curl -4 --max-time 8 -sS https://api.telegram.org/bot<TOKEN>/getMe
```

Ожидается `{"ok":true,...}`.

Далее:

```bash
curl -sS "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Должно улучшиться:
- `last_error_message` пустой;
- `pending_update_count` перестает расти и уходит вниз.

Также проверить логи:

```bash
docker logs --since=10m tele-shop-prod
```

---

## 7) Роллбек (если нужно быстро отключить)

На REG.RU VPS:

```bash
ip rule del fwmark 0x66 table telegramwg priority 10066 || true
ip route flush table telegramwg || true
iptables -t mangle -D OUTPUT -p tcp -m set --match-set telegram_api dst -j MARK --set-mark 0x66 || true
systemctl disable --now telegram-ipset-refresh.timer || true
systemctl stop wg-quick@wg0 || true
```

После rollback сервер вернется к исходной маршрутизации.

---

## 8) Комментарии по безопасности/эксплуатации

- Не используйте `AllowedIPs=0.0.0.0/0` на уровне system route без policy routing, иначе случайно уедет весь трафик.
- Split tunnel с `ip rule + fwmark` оставляет основной прод-трафик нетронутым.
- Следите за `wg show` (`latest handshake`, `transfer`) и таймерами обновления `ipset`.

---

## 9) Что можно улучшить дополнительно

- Добавить в приложение отдельный health-check endpoint для Telegram connectivity (`getMe` probe с timeout).
- Вынести Telegram API вызовы в очередь/retry worker, чтобы webhook всегда отвечал мгновенно.
- Добавить circuit breaker: при серии timeout временно пропускать исходящие Telegram-вызовы с логированием.

