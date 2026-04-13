alter table public.orders
  add column if not exists order_client_channel text,
  add column if not exists order_continuation text;

comment on column public.orders.order_client_channel is 'web | telegram_mini | max_mini — канал оформления';
comment on column public.orders.order_continuation is 'web_to_telegram | web_to_max — продолжение сценария с сайта в боте, иначе null';
