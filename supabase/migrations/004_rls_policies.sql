create or replace function public.current_shop_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'shop_id', '')::uuid
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;
    drop policy if exists profiles_select_tenant on public.profiles;
    drop policy if exists profiles_insert_tenant on public.profiles;
    drop policy if exists profiles_update_tenant on public.profiles;

    create policy profiles_select_tenant
      on public.profiles
      for select
      using (shop_id = public.current_shop_id());

    create policy profiles_insert_tenant
      on public.profiles
      for insert
      with check (shop_id = public.current_shop_id());

    create policy profiles_update_tenant
      on public.profiles
      for update
      using (shop_id = public.current_shop_id())
      with check (shop_id = public.current_shop_id());
  end if;

  if to_regclass('public.products') is not null then
    alter table public.products enable row level security;
    drop policy if exists products_select_tenant on public.products;
    drop policy if exists products_insert_tenant on public.products;
    drop policy if exists products_update_tenant on public.products;

    create policy products_select_tenant
      on public.products
      for select
      using (shop_id = public.current_shop_id());

    create policy products_insert_tenant
      on public.products
      for insert
      with check (shop_id = public.current_shop_id());

    create policy products_update_tenant
      on public.products
      for update
      using (shop_id = public.current_shop_id())
      with check (shop_id = public.current_shop_id());
  end if;

  if to_regclass('public.orders') is not null then
    alter table public.orders enable row level security;
    drop policy if exists orders_select_tenant on public.orders;
    drop policy if exists orders_insert_tenant on public.orders;
    drop policy if exists orders_update_tenant on public.orders;

    create policy orders_select_tenant
      on public.orders
      for select
      using (shop_id = public.current_shop_id());

    create policy orders_insert_tenant
      on public.orders
      for insert
      with check (shop_id = public.current_shop_id());

    create policy orders_update_tenant
      on public.orders
      for update
      using (shop_id = public.current_shop_id())
      with check (shop_id = public.current_shop_id());
  end if;
end $$;

alter table public.restaurants enable row level security;
drop policy if exists restaurants_select_tenant on public.restaurants;
drop policy if exists restaurants_insert_tenant on public.restaurants;
drop policy if exists restaurants_update_tenant on public.restaurants;
create policy restaurants_select_tenant
  on public.restaurants
  for select
  using (shop_id = public.current_shop_id());
create policy restaurants_insert_tenant
  on public.restaurants
  for insert
  with check (shop_id = public.current_shop_id());
create policy restaurants_update_tenant
  on public.restaurants
  for update
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

alter table public.restaurant_delivery_zones enable row level security;
drop policy if exists restaurant_delivery_zones_select_tenant on public.restaurant_delivery_zones;
drop policy if exists restaurant_delivery_zones_insert_tenant on public.restaurant_delivery_zones;
drop policy if exists restaurant_delivery_zones_update_tenant on public.restaurant_delivery_zones;
create policy restaurant_delivery_zones_select_tenant
  on public.restaurant_delivery_zones
  for select
  using (shop_id = public.current_shop_id());
create policy restaurant_delivery_zones_insert_tenant
  on public.restaurant_delivery_zones
  for insert
  with check (shop_id = public.current_shop_id());
create policy restaurant_delivery_zones_update_tenant
  on public.restaurant_delivery_zones
  for update
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());
