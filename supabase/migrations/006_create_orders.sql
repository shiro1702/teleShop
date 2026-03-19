create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  customer_telegram_id bigint,
  customer_profile_id uuid references auth.users(id) on delete set null,
  status text not null default 'new',
  fulfillment_type text not null default 'delivery',
  payment_method text not null default 'cash',
  subtotal integer not null default 0 check (subtotal >= 0),
  delivery_cost integer not null default 0 check (delivery_cost >= 0),
  total integer not null default 0 check (total >= 0),
  items jsonb not null default '[]'::jsonb,
  address jsonb,
  pickup_point jsonb,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_shop_id on public.orders (shop_id);
create index if not exists idx_orders_shop_id_created_at on public.orders (shop_id, created_at desc);
create index if not exists idx_orders_shop_id_status on public.orders (shop_id, status);
create index if not exists idx_orders_restaurant_id on public.orders (restaurant_id);
