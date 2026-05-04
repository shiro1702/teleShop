alter table public.restaurants
  add column if not exists festival_fulfillment_type text null
  check (festival_fulfillment_type in ('delivery', 'pickup', 'dine-in'));

create index if not exists idx_restaurants_festival_fulfillment
  on public.restaurants (festival_id, festival_fulfillment_type)
  where is_festival = true;

-- Demo convenience: keep city branches in city mode, and maintain exactly one
-- temporary pickup-only festival branch per shop for Amtatai 2026.
-- Default ON COMMIT PRESERVE ROWS: required so the temp table survives autocommit
-- between statements when this file is executed via psql (each statement is its own txn).
create temporary table tmp_kept_festival_branches as
with ranked as (
  select
    r.id,
    r.shop_id,
    row_number() over (partition by r.shop_id order by r.created_at asc, r.id asc) as rn
  from public.restaurants r
  join public.festivals f on f.id = r.festival_id
  where f.slug = 'amtatai-2026'
    and r.is_festival = true
    and r.name ilike '%фестиваль%'
)
select id, shop_id
from ranked
where rn = 1;

with target_festival as (
  select id as festival_id
  from public.festivals
  where slug = 'amtatai-2026'
  limit 1
)
update public.restaurants r
set
  festival_id = null,
  is_festival = false,
  festival_fulfillment_type = null,
  supports_delivery = true,
  supports_pickup = true,
  supports_dine_in = false,
  supports_qr_menu = false,
  supports_showcase_order = false
from target_festival tf
where r.festival_id = tf.festival_id
  and r.is_festival = true
  and not exists (
    select 1
    from tmp_kept_festival_branches kept
    where kept.id = r.id
  );

with target_festival as (
  select id as festival_id, city_id
  from public.festivals
  where slug = 'amtatai-2026'
  limit 1
)
update public.restaurants r
set
  city_id = tf.city_id,
  address = 'Корабельная улица, 32 (Пионер 2)',
  lat = null,
  lon = null,
  supports_delivery = false,
  supports_pickup = true,
  supports_dine_in = false,
  supports_qr_menu = false,
  supports_showcase_order = false,
  festival_id = tf.festival_id,
  is_festival = true,
  festival_fulfillment_type = 'pickup',
  is_active = true
from target_festival tf, tmp_kept_festival_branches kept
where kept.id = r.id;

with target_festival as (
  select f.id as festival_id, f.city_id
  from public.festivals f
  where f.slug = 'amtatai-2026'
  limit 1
),
source_branches as (
  select distinct on (r.shop_id)
    r.shop_id,
    r.city_id,
    s.name as shop_name,
    r.use_organization_working_hours,
    r.working_hours
  from public.restaurants r
  join public.shops s on s.id = r.shop_id
  join target_festival tf on tf.city_id = r.city_id
  where r.is_active = true
    and coalesce(r.is_festival, false) = false
    and not exists (
      select 1
      from public.restaurants existing
      where existing.shop_id = r.shop_id
        and existing.festival_id = tf.festival_id
        and existing.is_festival = true
        and existing.is_active = true
    )
  order by r.shop_id, r.created_at asc
)
insert into public.restaurants (
  shop_id,
  city_id,
  name,
  address,
  lat,
  lon,
  supports_delivery,
  supports_pickup,
  supports_dine_in,
  supports_qr_menu,
  supports_showcase_order,
  use_organization_working_hours,
  working_hours,
  festival_id,
  is_festival,
  festival_fulfillment_type,
  is_active
)
select
  sb.shop_id,
  sb.city_id,
  sb.shop_name || ' — фестиваль',
  'Корабельная улица, 32 (Пионер 2)',
  null,
  null,
  false,
  true,
  false,
  false,
  false,
  sb.use_organization_working_hours,
  sb.working_hours,
  tf.festival_id,
  true,
  'pickup',
  true
from source_branches sb
cross join target_festival tf;

drop table if exists tmp_kept_festival_branches;
