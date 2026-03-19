create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  address text not null,
  supports_delivery boolean not null default true,
  supports_pickup boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurants_shop_id on public.restaurants (shop_id);

create table if not exists public.restaurant_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  polygon_geojson jsonb not null,
  min_order_amount integer not null default 0,
  delivery_cost integer not null default 0,
  free_delivery_threshold integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurant_delivery_zones_shop_id on public.restaurant_delivery_zones (shop_id);
create index if not exists idx_restaurant_delivery_zones_restaurant_id on public.restaurant_delivery_zones (restaurant_id);

create or replace function public.check_zone_shop_consistency()
returns trigger
language plpgsql
as $$
declare
  restaurant_shop_id uuid;
begin
  select r.shop_id into restaurant_shop_id
  from public.restaurants r
  where r.id = new.restaurant_id;

  if restaurant_shop_id is null then
    raise exception 'Restaurant % not found', new.restaurant_id;
  end if;

  if restaurant_shop_id <> new.shop_id then
    raise exception 'shop_id mismatch for restaurant_delivery_zones';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_zone_shop_consistency on public.restaurant_delivery_zones;
create trigger trg_check_zone_shop_consistency
before insert or update on public.restaurant_delivery_zones
for each row execute function public.check_zone_shop_consistency();
