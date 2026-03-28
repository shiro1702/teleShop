create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  image text not null,
  description text,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_shop_id on public.products (shop_id);
create index if not exists idx_products_shop_id_category on public.products (shop_id, category);
create index if not exists idx_products_shop_id_is_active on public.products (shop_id, is_active);
