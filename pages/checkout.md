# /checkout

- Legacy маршрут checkout без города.
- Должен вести на `/:city_slug/checkout` или `/:city_slug/:tenant_slug/checkout`.
- Для онлайн-оплаты используется тот же серверный поток, что и в каноническом checkout:
  - создание платежа на сервере;
  - redirect на провайдера;
  - финальный статус по webhook.
