alter table public.restaurants
  add column if not exists lat double precision null,
  add column if not exists lon double precision null;
