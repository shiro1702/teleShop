-- Promocodes, loyalty balances, ledger; order columns for discounts/bonus

create table if not exists public.shop_promo_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,
  type text not null check (type in ('percent', 'fixed', 'free_item')),
  value integer not null default 0 check (value >= 0),
  min_order_amount integer not null default 0 check (min_order_amount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses_total integer check (max_uses_total is null or max_uses_total > 0),
  max_uses_per_user integer check (max_uses_per_user is null or max_uses_per_user > 0),
  is_active boolean not null default true,
  free_item_product_id uuid references public.products(id) on delete set null,
  free_item_parameter_option_id uuid references public.parameter_options(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, code)
);

create index if not exists idx_shop_promo_codes_shop_id on public.shop_promo_codes (shop_id);
create index if not exists idx_shop_promo_codes_shop_active on public.shop_promo_codes (shop_id, is_active);

create table if not exists public.promo_code_uses (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.shop_promo_codes(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_profile_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_promo_code_uses_promo on public.promo_code_uses (promo_code_id);
create index if not exists idx_promo_code_uses_order on public.promo_code_uses (order_id);
create index if not exists idx_promo_code_uses_customer on public.promo_code_uses (promo_code_id, customer_profile_id);

create table if not exists public.shop_loyalty_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  bonuses_enabled boolean not null default true,
  earn_percent_of_subtotal integer not null default 5 check (earn_percent_of_subtotal >= 0 and earn_percent_of_subtotal <= 100),
  max_order_percent_payable_with_bonus integer not null default 25 check (
    max_order_percent_payable_with_bonus >= 0 and max_order_percent_payable_with_bonus <= 100
  ),
  expiry_enabled boolean not null default false,
  expiry_days_inactivity integer check (expiry_days_inactivity is null or expiry_days_inactivity > 0),
  welcome_bonus_amount integer not null default 0 check (welcome_bonus_amount >= 0),
  birthday_bonus_amount integer not null default 0 check (birthday_bonus_amount >= 0),
  review_bonus_amount integer not null default 0 check (review_bonus_amount >= 0),
  birthday_bonus_days_before integer not null default 7 check (birthday_bonus_days_before >= 0 and birthday_bonus_days_before <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_loyalty_settings
  add column if not exists bonuses_enabled boolean not null default true;
alter table public.shop_loyalty_settings
  alter column earn_percent_of_subtotal set default 5;
alter table public.shop_loyalty_settings
  alter column max_order_percent_payable_with_bonus set default 25;

create table if not exists public.shop_customer_balances (
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_profile_id uuid not null references auth.users(id) on delete cascade,
  balance integer not null default 0,
  last_activity_at timestamptz not null default now(),
  primary key (shop_id, customer_profile_id)
);

create index if not exists idx_shop_customer_balances_profile on public.shop_customer_balances (customer_profile_id);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_profile_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  delta integer not null,
  reason text not null check (reason in (
    'earn_order', 'spend_order', 'welcome', 'birthday', 'review', 'expire', 'adjustment'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_ledger_earn_order_unique
  on public.loyalty_ledger (order_id)
  where reason = 'earn_order' and order_id is not null;

create unique index if not exists loyalty_ledger_spend_order_unique
  on public.loyalty_ledger (order_id)
  where reason = 'spend_order' and order_id is not null;

alter table public.orders
  add column if not exists promo_code_id uuid references public.shop_promo_codes(id) on delete set null,
  add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0),
  add column if not exists bonus_amount_spent integer not null default 0 check (bonus_amount_spent >= 0),
  add column if not exists promo_snapshot jsonb not null default '{}'::jsonb;

create index if not exists idx_orders_promo_code_id on public.orders (promo_code_id);

-- RLS: tenant tables for dashboard JWT
alter table public.shop_promo_codes enable row level security;
drop policy if exists shop_promo_codes_tenant on public.shop_promo_codes;
create policy shop_promo_codes_tenant
  on public.shop_promo_codes for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

alter table public.promo_code_uses enable row level security;
drop policy if exists promo_code_uses_tenant on public.promo_code_uses;
create policy promo_code_uses_tenant
  on public.promo_code_uses for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

alter table public.shop_loyalty_settings enable row level security;
drop policy if exists shop_loyalty_settings_tenant on public.shop_loyalty_settings;
create policy shop_loyalty_settings_tenant
  on public.shop_loyalty_settings for all
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

alter table public.shop_customer_balances enable row level security;
drop policy if exists shop_customer_balances_own_select on public.shop_customer_balances;
create policy shop_customer_balances_own_select
  on public.shop_customer_balances for select
  using (customer_profile_id = auth.uid());

alter table public.loyalty_ledger enable row level security;
drop policy if exists loyalty_ledger_own_select on public.loyalty_ledger;
create policy loyalty_ledger_own_select
  on public.loyalty_ledger for select
  using (customer_profile_id = auth.uid());
