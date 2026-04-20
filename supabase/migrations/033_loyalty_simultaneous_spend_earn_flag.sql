alter table public.shop_loyalty_settings
  add column if not exists allow_simultaneous_bonus_spend_and_earn boolean not null default false;
