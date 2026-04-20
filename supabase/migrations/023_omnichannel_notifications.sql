create extension if not exists pgcrypto;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null unique,
  event_type text not null,
  channel text not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  conversation_id text,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_events_shop_created
  on public.notification_events (shop_id, created_at desc);

create index if not exists idx_notification_events_status
  on public.notification_events (delivery_status, updated_at desc);

create index if not exists idx_notification_events_restaurant
  on public.notification_events (restaurant_id);

alter table public.restaurants
  add column if not exists manager_notification_mode text not null default 'group',
  add column if not exists manager_group_chat_id text,
  add column if not exists manager_max_chat_id text,
  add column if not exists manager_recipients jsonb not null default '[]'::jsonb;

alter table public.shops
  add column if not exists channel_policy jsonb not null default '{"primary":"telegram","secondary":"max","maxEnabled":false}'::jsonb;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists max_user_id text,
      add column if not exists max_chat_id text,
      add column if not exists max_conversation_id text;
  end if;
end $$;
