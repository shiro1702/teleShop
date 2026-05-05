alter table public.restaurants
  add column if not exists integration_keys jsonb not null default '{}'::jsonb;

