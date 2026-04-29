create extension if not exists pgcrypto;

alter table public.restaurants
  add column if not exists service_calls_enabled boolean not null default false,
  add column if not exists service_call_types jsonb not null default '["call_waiter","call_hookah","request_bill"]'::jsonb;

create table if not exists public.restaurant_staff_bot_bindings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'max')),
  external_user_id text not null,
  staff_role text not null check (staff_role in ('waiter', 'hookah', 'cashier', 'manager')),
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, channel, external_user_id)
);

create index if not exists idx_staff_bindings_shop_restaurant
  on public.restaurant_staff_bot_bindings (shop_id, restaurant_id, is_active);

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  customer_telegram_id bigint,
  customer_max_user_id text,
  customer_max_conversation_id text,
  call_type text not null check (call_type in ('call_waiter', 'call_hookah', 'request_bill')),
  status text not null default 'created' check (status in ('created', 'acknowledged', 'in_progress', 'resolved', 'cancelled')),
  source_channel text not null default 'chat' check (source_channel in ('chat', 'web')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_service_calls_idempotency_per_order
  on public.service_calls (order_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_service_calls_shop_restaurant_created
  on public.service_calls (shop_id, restaurant_id, created_at desc);

create index if not exists idx_service_calls_order_status
  on public.service_calls (order_id, status, created_at desc);

create table if not exists public.service_call_events (
  id uuid primary key default gen_random_uuid(),
  service_call_id uuid not null references public.service_calls(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed', 'staff_response', 'system_note')),
  event_status text,
  channel text not null check (channel in ('system', 'telegram', 'max', 'dashboard')),
  actor_binding_id uuid references public.restaurant_staff_bot_bindings(id) on delete set null,
  actor_external_user_id text,
  actor_display_name text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_call_events_call_created
  on public.service_call_events (service_call_id, created_at asc);
