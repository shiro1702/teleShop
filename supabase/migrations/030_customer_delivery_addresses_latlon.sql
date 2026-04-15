alter table if exists public.customer_delivery_addresses
  add column if not exists lat double precision null,
  add column if not exists lon double precision null;
