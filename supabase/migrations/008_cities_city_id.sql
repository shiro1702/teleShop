create extension if not exists pgcrypto;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cities_is_active on public.cities (is_active);

insert into public.cities (name, slug, is_active)
values ('Улан-Удэ', 'ulan-ude', true)
on conflict (slug) do update
set
  name = excluded.name,
  is_active = excluded.is_active;

alter table public.restaurants
  add column if not exists city_id uuid references public.cities(id) on delete restrict;

update public.restaurants r
set city_id = c.id
from public.cities c
where c.slug = 'ulan-ude'
  and r.city_id is null;

alter table public.restaurants
  alter column city_id set not null;

create index if not exists idx_restaurants_city_id on public.restaurants (city_id);
create index if not exists idx_restaurants_shop_id_city_id on public.restaurants (shop_id, city_id);

alter table public.orders
  add column if not exists city_id uuid references public.cities(id) on delete restrict;

update public.orders o
set city_id = r.city_id
from public.restaurants r
where o.city_id is null
  and o.restaurant_id is not null
  and r.id = o.restaurant_id
  and r.city_id is not null;

update public.orders o
set city_id = c.id
from public.cities c
where c.slug = 'ulan-ude'
  and o.city_id is null;

alter table public.orders
  alter column city_id set not null;

create index if not exists idx_orders_city_id on public.orders (city_id);
create index if not exists idx_orders_city_id_created_at on public.orders (city_id, created_at desc);

create or replace function public.resolve_default_city_id()
returns uuid
language sql
stable
as $$
  select c.id
  from public.cities c
  where c.slug = 'ulan-ude'
  limit 1
$$;

create or replace function public.ensure_order_city_id()
returns trigger
language plpgsql
as $$
declare
  restaurant_city_id uuid;
  default_city_id uuid;
begin
  if new.city_id is not null then
    return new;
  end if;

  if new.restaurant_id is not null then
    select r.city_id
    into restaurant_city_id
    from public.restaurants r
    where r.id = new.restaurant_id;

    if restaurant_city_id is not null then
      new.city_id := restaurant_city_id;
      return new;
    end if;
  end if;

  select public.resolve_default_city_id() into default_city_id;
  if default_city_id is null then
    raise exception 'Default city (ulan-ude) is missing';
  end if;

  new.city_id := default_city_id;
  return new;
end;
$$;

drop trigger if exists trg_ensure_order_city_id on public.orders;
create trigger trg_ensure_order_city_id
before insert or update on public.orders
for each row execute function public.ensure_order_city_id();
