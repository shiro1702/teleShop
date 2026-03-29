-- 1. Drop old tables (they are new, so it's safe to drop and recreate)
drop table if exists public.product_parameter_options cascade;
drop table if exists public.product_parameters cascade;

-- 2. Create parameter_options (now linked to parameter_kinds, not products)
create table if not exists public.parameter_options (
  id uuid primary key default gen_random_uuid(),
  parameter_kind_id uuid not null references public.parameter_kinds(id) on delete cascade,
  name text not null,
  weight_g integer,
  volume_ml integer,
  pieces integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parameter_options_kind_id on public.parameter_options (parameter_kind_id);

-- 3. Create category_parameter_kinds (link parameters to categories)
create table if not exists public.category_parameter_kinds (
  category_id uuid not null references public.categories(id) on delete cascade,
  parameter_kind_id uuid not null references public.parameter_kinds(id) on delete cascade,
  is_required boolean not null default true,
  primary key (category_id, parameter_kind_id)
);

-- 4. Create product_parameter_kinds (link parameters directly to products)
create table if not exists public.product_parameter_kinds (
  product_id uuid not null references public.products(id) on delete cascade,
  parameter_kind_id uuid not null references public.parameter_kinds(id) on delete cascade,
  is_required boolean not null default true,
  primary key (product_id, parameter_kind_id)
);

-- 5. Create product_parameter_option_overrides (prices and visibility for options on specific products)
create table if not exists public.product_parameter_option_overrides (
  product_id uuid not null references public.products(id) on delete cascade,
  option_id uuid not null references public.parameter_options(id) on delete cascade,
  price integer, -- if null, the option is not available for this product
  is_disabled boolean not null default false,
  is_default boolean not null default false,
  primary key (product_id, option_id)
);

-- RLS policies
alter table public.parameter_options enable row level security;
alter table public.category_parameter_kinds enable row level security;
alter table public.product_parameter_kinds enable row level security;
alter table public.product_parameter_option_overrides enable row level security;

-- parameter_options
create policy "Public read access for parameter_options"
  on public.parameter_options for select using (true);

create policy "Shop members can manage parameter_options"
  on public.parameter_options for all
  using (
    exists (
      select 1 from public.parameter_kinds
      join public.shop_members on shop_members.shop_id = parameter_kinds.shop_id
      where parameter_kinds.id = parameter_options.parameter_kind_id
      and shop_members.user_id = auth.uid()
    )
  );

-- category_parameter_kinds
create policy "Public read access for category_parameter_kinds"
  on public.category_parameter_kinds for select using (true);

create policy "Shop members can manage category_parameter_kinds"
  on public.category_parameter_kinds for all
  using (
    exists (
      select 1 from public.categories
      join public.shop_members on shop_members.shop_id = categories.shop_id
      where categories.id = category_parameter_kinds.category_id
      and shop_members.user_id = auth.uid()
    )
  );

-- product_parameter_kinds
create policy "Public read access for product_parameter_kinds"
  on public.product_parameter_kinds for select using (true);

create policy "Shop members can manage product_parameter_kinds"
  on public.product_parameter_kinds for all
  using (
    exists (
      select 1 from public.products
      join public.shop_members on shop_members.shop_id = products.shop_id
      where products.id = product_parameter_kinds.product_id
      and shop_members.user_id = auth.uid()
    )
  );

-- product_parameter_option_overrides
create policy "Public read access for product_parameter_option_overrides"
  on public.product_parameter_option_overrides for select using (true);

create policy "Shop members can manage product_parameter_option_overrides"
  on public.product_parameter_option_overrides for all
  using (
    exists (
      select 1 from public.products
      join public.shop_members on shop_members.shop_id = products.shop_id
      where products.id = product_parameter_option_overrides.product_id
      and shop_members.user_id = auth.uid()
    )
  );
