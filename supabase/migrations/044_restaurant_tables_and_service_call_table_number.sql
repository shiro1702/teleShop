create extension if not exists pgcrypto;

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null,
  qr_slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_number_not_blank check (length(trim(table_number)) > 0),
  constraint restaurant_tables_slug_not_blank check (length(trim(qr_slug)) > 0),
  unique (restaurant_id, table_number),
  unique (qr_slug)
);

create index if not exists idx_restaurant_tables_shop_restaurant_active
  on public.restaurant_tables (shop_id, restaurant_id, is_active);

alter table public.service_calls
  add column if not exists table_number text;

alter table public.service_calls
  alter column order_id drop not null;

alter table public.service_call_events
  alter column order_id drop not null;
