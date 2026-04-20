create table if not exists public.cart_cross_sell_product_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_product_id uuid not null references public.products(id) on delete cascade,
  target_product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_cross_sell_product_links_source_target_check
    check (source_product_id <> target_product_id)
);

create index if not exists idx_cart_cross_sell_product_links_shop_id
  on public.cart_cross_sell_product_links (shop_id);
create index if not exists idx_cart_cross_sell_product_links_source_product
  on public.cart_cross_sell_product_links (source_product_id);
create unique index if not exists uq_cart_cross_sell_product_links_shop_source_target
  on public.cart_cross_sell_product_links (shop_id, source_product_id, target_product_id);

create table if not exists public.cart_cross_sell_category_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  source_category_id uuid not null references public.categories(id) on delete cascade,
  target_category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_cross_sell_category_links_source_target_check
    check (source_category_id <> target_category_id)
);

create index if not exists idx_cart_cross_sell_category_links_shop_id
  on public.cart_cross_sell_category_links (shop_id);
create index if not exists idx_cart_cross_sell_category_links_source_category
  on public.cart_cross_sell_category_links (source_category_id);
create unique index if not exists uq_cart_cross_sell_category_links_shop_source_target
  on public.cart_cross_sell_category_links (shop_id, source_category_id, target_category_id);

create table if not exists public.cart_cross_sell_global_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  target_category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cart_cross_sell_global_categories_shop_id
  on public.cart_cross_sell_global_categories (shop_id);
create unique index if not exists uq_cart_cross_sell_global_categories_shop_target
  on public.cart_cross_sell_global_categories (shop_id, target_category_id);

alter table public.cart_cross_sell_product_links enable row level security;
alter table public.cart_cross_sell_category_links enable row level security;
alter table public.cart_cross_sell_global_categories enable row level security;

drop policy if exists cart_cross_sell_product_links_select_tenant on public.cart_cross_sell_product_links;
create policy cart_cross_sell_product_links_select_tenant on public.cart_cross_sell_product_links
  for select using (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_product_links_insert_tenant on public.cart_cross_sell_product_links;
create policy cart_cross_sell_product_links_insert_tenant on public.cart_cross_sell_product_links
  for insert with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_product_links_update_tenant on public.cart_cross_sell_product_links;
create policy cart_cross_sell_product_links_update_tenant on public.cart_cross_sell_product_links
  for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_product_links_delete_tenant on public.cart_cross_sell_product_links;
create policy cart_cross_sell_product_links_delete_tenant on public.cart_cross_sell_product_links
  for delete using (shop_id = public.current_shop_id());

drop policy if exists cart_cross_sell_category_links_select_tenant on public.cart_cross_sell_category_links;
create policy cart_cross_sell_category_links_select_tenant on public.cart_cross_sell_category_links
  for select using (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_category_links_insert_tenant on public.cart_cross_sell_category_links;
create policy cart_cross_sell_category_links_insert_tenant on public.cart_cross_sell_category_links
  for insert with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_category_links_update_tenant on public.cart_cross_sell_category_links;
create policy cart_cross_sell_category_links_update_tenant on public.cart_cross_sell_category_links
  for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_category_links_delete_tenant on public.cart_cross_sell_category_links;
create policy cart_cross_sell_category_links_delete_tenant on public.cart_cross_sell_category_links
  for delete using (shop_id = public.current_shop_id());

drop policy if exists cart_cross_sell_global_categories_select_tenant on public.cart_cross_sell_global_categories;
create policy cart_cross_sell_global_categories_select_tenant on public.cart_cross_sell_global_categories
  for select using (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_global_categories_insert_tenant on public.cart_cross_sell_global_categories;
create policy cart_cross_sell_global_categories_insert_tenant on public.cart_cross_sell_global_categories
  for insert with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_global_categories_update_tenant on public.cart_cross_sell_global_categories;
create policy cart_cross_sell_global_categories_update_tenant on public.cart_cross_sell_global_categories
  for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());
drop policy if exists cart_cross_sell_global_categories_delete_tenant on public.cart_cross_sell_global_categories;
create policy cart_cross_sell_global_categories_delete_tenant on public.cart_cross_sell_global_categories
  for delete using (shop_id = public.current_shop_id());
