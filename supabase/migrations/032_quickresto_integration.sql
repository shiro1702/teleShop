create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists external_order_id text,
  add column if not exists external_status text,
  add column if not exists last_sync_error text;

create index if not exists idx_orders_shop_external_order_id
  on public.orders (shop_id, external_order_id)
  where external_order_id is not null;

create table if not exists public.quickresto_restaurant_mapping (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  quickresto_place_id text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, restaurant_id),
  unique (shop_id, quickresto_place_id)
);

create table if not exists public.quickresto_sync_jobs (
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

create index if not exists idx_quickresto_sync_jobs_shop_created
  on public.quickresto_sync_jobs (shop_id, created_at desc);

create unique index if not exists quickresto_one_running_job_per_shop
  on public.quickresto_sync_jobs (shop_id)
  where status = 'running';

create table if not exists public.quickresto_events (
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

create index if not exists idx_quickresto_events_shop_created
  on public.quickresto_events (shop_id, created_at desc);

create table if not exists public.quickresto_order_outbox (
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

create index if not exists idx_quickresto_order_outbox_status_retry
  on public.quickresto_order_outbox (shop_id, status, next_retry_at, created_at);

alter table public.quickresto_restaurant_mapping enable row level security;
alter table public.quickresto_sync_jobs enable row level security;
alter table public.quickresto_events enable row level security;
alter table public.quickresto_order_outbox enable row level security;

drop policy if exists quickresto_restaurant_mapping_tenant on public.quickresto_restaurant_mapping;
create policy quickresto_restaurant_mapping_tenant
  on public.quickresto_restaurant_mapping for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists quickresto_sync_jobs_tenant on public.quickresto_sync_jobs;
create policy quickresto_sync_jobs_tenant
  on public.quickresto_sync_jobs for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists quickresto_events_tenant on public.quickresto_events;
create policy quickresto_events_tenant
  on public.quickresto_events for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

drop policy if exists quickresto_order_outbox_tenant on public.quickresto_order_outbox;
create policy quickresto_order_outbox_tenant
  on public.quickresto_order_outbox for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());
