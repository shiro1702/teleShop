do $$
begin
  if to_regclass('public.products') is not null then
    alter table public.products
      add column if not exists shop_id uuid references public.shops(id) on delete restrict;
    create index if not exists idx_products_shop_id on public.products (shop_id);
  end if;

  if to_regclass('public.orders') is not null then
    alter table public.orders
      add column if not exists shop_id uuid references public.shops(id) on delete restrict;
    create index if not exists idx_orders_shop_id on public.orders (shop_id);
    create index if not exists idx_orders_shop_id_created_at on public.orders (shop_id, created_at desc);
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists shop_id uuid references public.shops(id) on delete restrict;
    create index if not exists idx_profiles_shop_id on public.profiles (shop_id);
  end if;
end $$;
