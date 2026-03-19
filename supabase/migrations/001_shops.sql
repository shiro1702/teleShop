create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  telegram_bot_token text not null,
  telegram_bot_id bigint unique,
  manager_chat_id text,
  integration_keys jsonb not null default '{}'::jsonb,
  ui_settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_shops_is_active on public.shops (is_active);
