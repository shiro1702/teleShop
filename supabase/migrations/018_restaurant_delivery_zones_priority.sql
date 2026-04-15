-- Tie-break for overlapping zones with the same delivery_cost: higher priority wins.
alter table public.restaurant_delivery_zones
  add column if not exists priority integer not null default 0;

comment on column public.restaurant_delivery_zones.priority is
  'Higher value wins when multiple active zones match the same point and delivery_cost is equal';
