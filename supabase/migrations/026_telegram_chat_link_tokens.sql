create table if not exists public.telegram_chat_link_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  token text not null unique,
  created_by uuid,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_chat_link_tokens_expires
  on public.telegram_chat_link_tokens (expires_at desc);

create index if not exists idx_telegram_chat_link_tokens_shop_restaurant
  on public.telegram_chat_link_tokens (shop_id, restaurant_id, created_at desc);

create unique index if not exists uq_restaurants_manager_group_chat_id_not_empty
  on public.restaurants ((nullif(trim(manager_group_chat_id), '')))
  where nullif(trim(manager_group_chat_id), '') is not null;
