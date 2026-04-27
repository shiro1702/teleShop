create extension if not exists pgcrypto;

create table if not exists public.iiko_restaurant_mapping (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  iiko_terminal_group_id text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, restaurant_id),
  unique (shop_id, iiko_terminal_group_id)
);

create table if not exists public.iiko_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  job_type text not null check (job_type in ('menu_sync', 'stoplist_sync', 'promocodes_sync', 'order_retry', 'loyalty_reconcile')),
  mode text not null default 'run' check (mode in ('run', 'dry_run')),
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed')),
  attempts integer not null default 0,
  initiated_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_iiko_sync_jobs_shop_created
  on public.iiko_sync_jobs (shop_id, created_at desc);

create unique index if not exists iiko_one_running_job_per_shop
  on public.iiko_sync_jobs (shop_id)
  where status = 'running';

create table if not exists public.iiko_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  event_type text not null,
  external_event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  signature text,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (shop_id, external_event_id)
);

create index if not exists idx_iiko_events_shop_created
  on public.iiko_events (shop_id, created_at desc);

create table if not exists public.iiko_order_outbox (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  external_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, order_id),
  unique (shop_id, idempotency_key)
);

create index if not exists idx_iiko_order_outbox_status_retry
  on public.iiko_order_outbox (shop_id, status, next_retry_at, created_at);

alter table public.iiko_restaurant_mapping enable row level security;
alter table public.iiko_sync_jobs enable row level security;
alter table public.iiko_events enable row level security;
alter table public.iiko_order_outbox enable row level security;

drop policy if exists iiko_restaurant_mapping_tenant on public.iiko_restaurant_mapping;
create policy iiko_restaurant_mapping_tenant
  on public.iiko_restaurant_mapping for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists iiko_sync_jobs_tenant on public.iiko_sync_jobs;
create policy iiko_sync_jobs_tenant
  on public.iiko_sync_jobs for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists iiko_events_tenant on public.iiko_events;
create policy iiko_events_tenant
  on public.iiko_events for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists iiko_order_outbox_tenant on public.iiko_order_outbox;
create policy iiko_order_outbox_tenant
  on public.iiko_order_outbox for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());
