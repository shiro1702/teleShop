alter table public.shops
  add column if not exists legal_name text,
  add column if not exists inn text,
  add column if not exists ogrn text,
  add column if not exists yookassa_shop_id text,
  add column if not exists yookassa_secret_key text;

alter table public.orders
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_provider text,
  add column if not exists payment_id text,
  add column if not exists paid_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'canceled', 'refunded'));
  end if;
end $$;

create index if not exists idx_orders_shop_payment_status on public.orders (shop_id, payment_status);
create index if not exists idx_orders_payment_id on public.orders (payment_id);

create table if not exists public.order_payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  amount integer not null check (amount >= 0),
  currency text not null default 'RUB',
  status text not null default 'created',
  idempotence_key text not null,
  confirmation_url text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index if not exists idx_order_payment_intents_order_id on public.order_payment_intents (order_id);
create index if not exists idx_order_payment_intents_shop_id on public.order_payment_intents (shop_id, created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  provider_payment_id text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index if not exists idx_payment_webhook_events_provider_created on public.payment_webhook_events (provider, created_at desc);
