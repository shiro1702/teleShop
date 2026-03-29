create table if not exists public.parameter_kinds (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, code)
);

create index if not exists idx_parameter_kinds_shop_id on public.parameter_kinds (shop_id);

create table if not exists public.product_parameters (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  parameter_kind_id uuid not null references public.parameter_kinds(id) on delete cascade,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, parameter_kind_id)
);

create index if not exists idx_product_parameters_product_id on public.product_parameters (product_id);

create table if not exists public.product_parameter_options (
  id uuid primary key default gen_random_uuid(),
  product_parameter_id uuid not null references public.product_parameters(id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  weight_g integer,
  volume_ml integer,
  pieces integer,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_parameter_options_param_id on public.product_parameter_options (product_parameter_id);

-- RLS policies
alter table public.parameter_kinds enable row level security;
alter table public.product_parameters enable row level security;
alter table public.product_parameter_options enable row level security;

-- parameter_kinds
create policy "Public read access for parameter_kinds"
  on public.parameter_kinds for select
  using (true);

create policy "Shop members can manage parameter_kinds"
  on public.parameter_kinds for all
  using (
    exists (
      select 1 from public.shop_members
      where shop_members.shop_id = parameter_kinds.shop_id
      and shop_members.user_id = auth.uid()
    )
  );

-- product_parameters
create policy "Public read access for product_parameters"
  on public.product_parameters for select
  using (true);

create policy "Shop members can manage product_parameters"
  on public.product_parameters for all
  using (
    exists (
      select 1 from public.products
      join public.shop_members on shop_members.shop_id = products.shop_id
      where products.id = product_parameters.product_id
      and shop_members.user_id = auth.uid()
    )
  );

-- product_parameter_options
create policy "Public read access for product_parameter_options"
  on public.product_parameter_options for select
  using (true);

create policy "Shop members can manage product_parameter_options"
  on public.product_parameter_options for all
  using (
    exists (
      select 1 from public.product_parameters
      join public.products on products.id = product_parameters.product_id
      join public.shop_members on shop_members.shop_id = products.shop_id
      where product_parameters.id = product_parameter_options.product_parameter_id
      and shop_members.user_id = auth.uid()
    )
  );
