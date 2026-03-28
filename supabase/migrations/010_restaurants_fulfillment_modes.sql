alter table public.restaurants
  add column if not exists supports_dine_in boolean not null default false,
  add column if not exists supports_qr_menu boolean not null default false,
  add column if not exists supports_showcase_order boolean not null default false;
