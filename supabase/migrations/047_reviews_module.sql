create table if not exists public.shop_review_moderation_channels (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  telegram_chat_id text,
  max_chat_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (telegram_chat_id is not null and length(trim(telegram_chat_id)) > 0)
    or (max_chat_id is not null and length(trim(max_chat_id)) > 0)
  )
);

create unique index if not exists uq_shop_review_moderation_channels_shop_restaurant
  on public.shop_review_moderation_channels (shop_id, restaurant_id);

create unique index if not exists uq_shop_review_moderation_channels_shop_global
  on public.shop_review_moderation_channels (shop_id)
  where restaurant_id is null;

create index if not exists idx_shop_review_moderation_channels_shop_active
  on public.shop_review_moderation_channels (shop_id, is_active);

create table if not exists public.shop_reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  customer_telegram_id bigint,
  customer_max_user_id text,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  video_url text,
  status text not null default 'new'
    check (status in ('new', 'manager_review', 'published', 'rejected', 'resolved')),
  moderation_channel text check (moderation_channel is null or moderation_channel in ('telegram', 'max')),
  moderation_chat_id text,
  moderation_message_id text,
  source text not null default 'orders' check (source in ('orders', 'dashboard')),
  metadata jsonb not null default '{}'::jsonb,
  forwarded_to_manager_at timestamptz,
  published_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_shop_reviews_order_id
  on public.shop_reviews (order_id);

create index if not exists idx_shop_reviews_shop_status_created
  on public.shop_reviews (shop_id, status, created_at desc);

create index if not exists idx_shop_reviews_shop_restaurant_status_created
  on public.shop_reviews (shop_id, restaurant_id, status, created_at desc);

create index if not exists idx_shop_reviews_shop_published
  on public.shop_reviews (shop_id, published_at desc)
  where status = 'published';

create index if not exists idx_shop_reviews_restaurant_published
  on public.shop_reviews (restaurant_id, published_at desc)
  where status = 'published';

create index if not exists idx_shop_reviews_profile_created
  on public.shop_reviews (profile_id, created_at desc);

create index if not exists idx_shop_reviews_telegram_created
  on public.shop_reviews (customer_telegram_id, created_at desc);

create table if not exists public.shop_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.shop_reviews(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  action text not null
    check (action in ('created', 'send_to_manager', 'publish', 'reject', 'resolve', 'reopen', 'edit')),
  action_payload jsonb not null default '{}'::jsonb,
  actor_channel text check (actor_channel is null or actor_channel in ('telegram', 'max', 'dashboard', 'system')),
  actor_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_shop_review_events_review_created
  on public.shop_review_events (review_id, created_at desc);

create index if not exists idx_shop_review_events_shop_created
  on public.shop_review_events (shop_id, created_at desc);
