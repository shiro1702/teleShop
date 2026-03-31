alter table public.orders
  add column if not exists order_number text;

create table if not exists public.order_daily_counters (
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  business_date date not null,
  last_seq integer not null check (last_seq > 0),
  primary key (shop_id, restaurant_id, business_date)
);

create or replace function public.next_order_human_number(
  p_shop_id uuid,
  p_restaurant_id uuid,
  p_created_at timestamptz default now()
)
returns text
language plpgsql
as $$
declare
  v_date date;
  v_seq integer;
begin
  if p_shop_id is null then
    raise exception 'p_shop_id is required';
  end if;
  if p_restaurant_id is null then
    raise exception 'p_restaurant_id is required';
  end if;

  v_date := (coalesce(p_created_at, now()) at time zone 'UTC')::date;

  insert into public.order_daily_counters (shop_id, restaurant_id, business_date, last_seq)
  values (p_shop_id, p_restaurant_id, v_date, 1)
  on conflict (shop_id, restaurant_id, business_date)
  do update
    set last_seq = public.order_daily_counters.last_seq + 1
  returning last_seq into v_seq;

  return to_char(v_date, 'DDMM') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

create or replace function public.orders_set_human_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := public.next_order_human_number(
      new.shop_id,
      new.restaurant_id,
      coalesce(new.created_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_set_human_number on public.orders;
create trigger trg_orders_set_human_number
before insert on public.orders
for each row
execute function public.orders_set_human_number();

with ranked as (
  select
    o.id,
    to_char((o.created_at at time zone 'UTC')::date, 'DDMM')
      || '-'
      || lpad(
        row_number() over (
          partition by o.shop_id, o.restaurant_id, (o.created_at at time zone 'UTC')::date
          order by o.created_at, o.id
        )::text,
        3,
        '0'
      ) as generated_number
  from public.orders o
  where o.restaurant_id is not null
)
update public.orders o
set order_number = ranked.generated_number
from ranked
where o.id = ranked.id
  and (o.order_number is null or btrim(o.order_number) = '');
