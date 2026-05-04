create table if not exists public.feature_catalog (
  code text primary key,
  name text not null,
  billing_type text not null check (billing_type in ('monthly', 'weekly', 'usage', 'hybrid')),
  price integer not null default 0,
  currency text not null default 'RUB',
  dependencies jsonb not null default '[]'::jsonb,
  status text not null default 'available' check (status in ('available', 'beta', 'request_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_feature_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  feature_code text not null references public.feature_catalog(code) on delete cascade,
  enabled boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'trial', 'billing', 'system', 'seed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, feature_code)
);

create index if not exists idx_shop_feature_subscriptions_shop_enabled
  on public.shop_feature_subscriptions (shop_id, enabled);

create table if not exists public.shop_feature_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  feature_code text not null references public.feature_catalog(code) on delete cascade,
  action text not null check (action in ('enabled', 'disabled', 'price_changed', 'trial_started', 'trial_ended')),
  payload jsonb not null default '{}'::jsonb,
  actor_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_shop_feature_events_shop_created
  on public.shop_feature_events (shop_id, created_at desc);

insert into public.feature_catalog (code, name, billing_type, price, dependencies, status)
values
  ('core_qr_menu', 'QR-меню', 'monthly', 0, '[]'::jsonb, 'available'),
  ('core_telegram_orders', 'Заказы в Telegram', 'monthly', 0, '[]'::jsonb, 'available'),
  ('crm_orders_db', 'CRM и история заказов', 'monthly', 1490, '[]'::jsonb, 'available'),
  ('reputation_reviews_pro', 'Отзывы и репутация Pro', 'monthly', 2490, '["crm_orders_db","core_telegram_orders"]'::jsonb, 'available')
on conflict (code) do update
set
  name = excluded.name,
  billing_type = excluded.billing_type,
  price = excluded.price,
  dependencies = excluded.dependencies,
  status = excluded.status,
  updated_at = now();

insert into public.shop_feature_subscriptions (shop_id, feature_code, enabled, source)
select s.id, 'core_qr_menu', true, 'seed'
from public.shops s
on conflict (shop_id, feature_code) do nothing;

insert into public.shop_feature_subscriptions (shop_id, feature_code, enabled, source)
select s.id, 'core_telegram_orders', true, 'seed'
from public.shops s
on conflict (shop_id, feature_code) do nothing;

insert into public.shop_feature_subscriptions (shop_id, feature_code, enabled, source)
select s.id, 'crm_orders_db', true, 'seed'
from public.shops s
on conflict (shop_id, feature_code) do nothing;
