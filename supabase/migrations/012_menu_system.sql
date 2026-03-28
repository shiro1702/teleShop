-- 1. Create categories table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_shop_id on public.categories (shop_id);
create index if not exists idx_categories_shop_id_sort_order on public.categories (shop_id, sort_order);

-- 2. Update products table
alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists external_id text;

-- Migrate existing categories from text to table
do $$
declare
  r record;
  cat_id uuid;
begin
  for r in select distinct shop_id, category from public.products where category is not null and category != '' loop
    -- Insert category if not exists
    insert into public.categories (shop_id, name)
    values (r.shop_id, r.category)
    returning id into cat_id;

    -- Update products with the new category_id
    update public.products
    set category_id = cat_id
    where shop_id = r.shop_id and category = r.category;
  end loop;
end $$;

-- 3. Create modifier_groups table
create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  selection_type text not null check (selection_type in ('single', 'multi', 'boolean')),
  is_required boolean not null default false,
  min_select integer not null default 0,
  max_select integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_modifier_groups_shop_id on public.modifier_groups (shop_id);

-- 4. Create modifier_options table
create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_modifier_options_group_id on public.modifier_options (group_id);

-- 5. Create product_modifier_groups table
create table if not exists public.product_modifier_groups (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  is_required_override boolean,
  min_select_override integer,
  max_select_override integer,
  primary key (product_id, group_id)
);

-- 6. Create category_modifier_groups table
create table if not exists public.category_modifier_groups (
  category_id uuid not null references public.categories(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  primary key (category_id, group_id)
);

-- 7. Create restaurant_product_overrides table
create table if not exists public.restaurant_product_overrides (
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_override integer check (price_override >= 0),
  is_hidden boolean not null default false,
  is_in_stop_list boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, product_id)
);

create index if not exists idx_restaurant_product_overrides_shop_id on public.restaurant_product_overrides (shop_id);
create index if not exists idx_restaurant_product_overrides_restaurant_id on public.restaurant_product_overrides (restaurant_id);

-- 8. RLS Policies
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'public.categories',
    'public.modifier_groups',
    'public.modifier_options',
    'public.product_modifier_groups',
    'public.category_modifier_groups',
    'public.restaurant_product_overrides'
  ]) loop
    execute format('alter table %s enable row level security', t);
    
    -- We'll use a simpler policy for options and junction tables by joining or assuming shop_id is present.
    -- For categories, modifier_groups, restaurant_product_overrides, shop_id exists.
  end loop;
end $$;

-- Policies for categories
drop policy if exists categories_select_tenant on public.categories;
create policy categories_select_tenant on public.categories for select using (shop_id = public.current_shop_id());
drop policy if exists categories_insert_tenant on public.categories;
create policy categories_insert_tenant on public.categories for insert with check (shop_id = public.current_shop_id());
drop policy if exists categories_update_tenant on public.categories;
create policy categories_update_tenant on public.categories for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists categories_delete_tenant on public.categories;
create policy categories_delete_tenant on public.categories for delete using (shop_id = public.current_shop_id());

-- Policies for modifier_groups
drop policy if exists modifier_groups_select_tenant on public.modifier_groups;
create policy modifier_groups_select_tenant on public.modifier_groups for select using (shop_id = public.current_shop_id());
drop policy if exists modifier_groups_insert_tenant on public.modifier_groups;
create policy modifier_groups_insert_tenant on public.modifier_groups for insert with check (shop_id = public.current_shop_id());
drop policy if exists modifier_groups_update_tenant on public.modifier_groups;
create policy modifier_groups_update_tenant on public.modifier_groups for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists modifier_groups_delete_tenant on public.modifier_groups;
create policy modifier_groups_delete_tenant on public.modifier_groups for delete using (shop_id = public.current_shop_id());

-- Policies for modifier_options (via group_id -> shop_id)
drop policy if exists modifier_options_select_tenant on public.modifier_options;
create policy modifier_options_select_tenant on public.modifier_options for select using (
  exists (select 1 from public.modifier_groups mg where mg.id = group_id and mg.shop_id = public.current_shop_id())
);
drop policy if exists modifier_options_insert_tenant on public.modifier_options;
create policy modifier_options_insert_tenant on public.modifier_options for insert with check (
  exists (select 1 from public.modifier_groups mg where mg.id = group_id and mg.shop_id = public.current_shop_id())
);
drop policy if exists modifier_options_update_tenant on public.modifier_options;
create policy modifier_options_update_tenant on public.modifier_options for update using (
  exists (select 1 from public.modifier_groups mg where mg.id = group_id and mg.shop_id = public.current_shop_id())
);
drop policy if exists modifier_options_delete_tenant on public.modifier_options;
create policy modifier_options_delete_tenant on public.modifier_options for delete using (
  exists (select 1 from public.modifier_groups mg where mg.id = group_id and mg.shop_id = public.current_shop_id())
);

-- Policies for product_modifier_groups (via product_id -> shop_id)
drop policy if exists product_modifier_groups_select_tenant on public.product_modifier_groups;
create policy product_modifier_groups_select_tenant on public.product_modifier_groups for select using (
  exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.current_shop_id())
);
drop policy if exists product_modifier_groups_insert_tenant on public.product_modifier_groups;
create policy product_modifier_groups_insert_tenant on public.product_modifier_groups for insert with check (
  exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.current_shop_id())
);
drop policy if exists product_modifier_groups_update_tenant on public.product_modifier_groups;
create policy product_modifier_groups_update_tenant on public.product_modifier_groups for update using (
  exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.current_shop_id())
);
drop policy if exists product_modifier_groups_delete_tenant on public.product_modifier_groups;
create policy product_modifier_groups_delete_tenant on public.product_modifier_groups for delete using (
  exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.current_shop_id())
);

-- Policies for category_modifier_groups (via category_id -> shop_id)
drop policy if exists category_modifier_groups_select_tenant on public.category_modifier_groups;
create policy category_modifier_groups_select_tenant on public.category_modifier_groups for select using (
  exists (select 1 from public.categories c where c.id = category_id and c.shop_id = public.current_shop_id())
);
drop policy if exists category_modifier_groups_insert_tenant on public.category_modifier_groups;
create policy category_modifier_groups_insert_tenant on public.category_modifier_groups for insert with check (
  exists (select 1 from public.categories c where c.id = category_id and c.shop_id = public.current_shop_id())
);
drop policy if exists category_modifier_groups_update_tenant on public.category_modifier_groups;
create policy category_modifier_groups_update_tenant on public.category_modifier_groups for update using (
  exists (select 1 from public.categories c where c.id = category_id and c.shop_id = public.current_shop_id())
);
drop policy if exists category_modifier_groups_delete_tenant on public.category_modifier_groups;
create policy category_modifier_groups_delete_tenant on public.category_modifier_groups for delete using (
  exists (select 1 from public.categories c where c.id = category_id and c.shop_id = public.current_shop_id())
);

-- Policies for restaurant_product_overrides
drop policy if exists restaurant_product_overrides_select_tenant on public.restaurant_product_overrides;
create policy restaurant_product_overrides_select_tenant on public.restaurant_product_overrides for select using (shop_id = public.current_shop_id());
drop policy if exists restaurant_product_overrides_insert_tenant on public.restaurant_product_overrides;
create policy restaurant_product_overrides_insert_tenant on public.restaurant_product_overrides for insert with check (shop_id = public.current_shop_id());
drop policy if exists restaurant_product_overrides_update_tenant on public.restaurant_product_overrides;
create policy restaurant_product_overrides_update_tenant on public.restaurant_product_overrides for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists restaurant_product_overrides_delete_tenant on public.restaurant_product_overrides;
create policy restaurant_product_overrides_delete_tenant on public.restaurant_product_overrides for delete using (shop_id = public.current_shop_id());
