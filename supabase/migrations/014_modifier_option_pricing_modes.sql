alter table public.modifier_options
  add column if not exists pricing_type text not null default 'delta'
  check (pricing_type in ('delta', 'multiplier'));

alter table public.modifier_options
  add column if not exists price_multiplier numeric(8,4);

update public.modifier_options
set pricing_type = 'delta'
where pricing_type is null;
