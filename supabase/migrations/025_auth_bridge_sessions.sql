create table if not exists public.auth_bridge_sessions (
  id uuid primary key default gen_random_uuid(),
  bridge_key text not null unique,
  shop_id text not null,
  scope_key text,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_bridge_sessions_expires
  on public.auth_bridge_sessions (expires_at desc);

alter table public.auth_tokens
  add column if not exists bridge_payload jsonb;
