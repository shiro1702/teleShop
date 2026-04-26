create table if not exists public.festival_moderation_chats (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  telegram_chat_id text,
  max_chat_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (festival_id, shop_id)
);

create index if not exists idx_festival_moderation_chats_festival_shop
  on public.festival_moderation_chats (festival_id, shop_id);

create table if not exists public.festival_ugc_submissions (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  order_item_payload jsonb not null default '{}'::jsonb,
  author_profile_id uuid references public.profiles(id) on delete set null,
  author_telegram_id bigint,
  author_max_user_id text,
  kind text not null check (kind in ('story', 'video_review')),
  rating smallint check (rating is null or rating between 1 and 5),
  category text check (category is null or category in ('live', 'food', 'stage', 'vibe', 'quest')),
  media_url text not null,
  media_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved_menu', 'approved_feed', 'approved_menu_and_feed', 'rejected', 'forwarded_to_corner', 'shadow_banned')),
  publish_to_menu boolean not null default false,
  publish_to_feed boolean not null default false,
  moderation_channel text check (moderation_channel is null or moderation_channel in ('telegram', 'max')),
  moderation_chat_id text,
  moderation_message_id text,
  forwarded_to_restaurant_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_festival_ugc_submissions_festival_status_created
  on public.festival_ugc_submissions (festival_id, status, created_at desc);
create index if not exists idx_festival_ugc_submissions_shop_restaurant
  on public.festival_ugc_submissions (shop_id, restaurant_id);
create index if not exists idx_festival_ugc_submissions_author_profile
  on public.festival_ugc_submissions (author_profile_id, created_at desc);
create index if not exists idx_festival_ugc_submissions_order
  on public.festival_ugc_submissions (order_id);
create index if not exists idx_festival_ugc_submissions_kind_category
  on public.festival_ugc_submissions (kind, category);

create table if not exists public.festival_ugc_moderation_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.festival_ugc_submissions(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  action text not null
    check (action in ('approve_menu', 'approve_feed', 'approve_menu_and_feed', 'tag_category', 'reject', 'forward_to_corner', 'shadow_ban', 'restore')),
  action_payload jsonb not null default '{}'::jsonb,
  actor_channel text check (actor_channel is null or actor_channel in ('telegram', 'max', 'dashboard')),
  actor_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_festival_ugc_moderation_events_submission_created
  on public.festival_ugc_moderation_events (submission_id, created_at desc);
create index if not exists idx_festival_ugc_moderation_events_festival_created
  on public.festival_ugc_moderation_events (festival_id, created_at desc);

create table if not exists public.festival_ugc_bans (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  telegram_id bigint,
  max_user_id text,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    profile_id is not null
    or telegram_id is not null
    or (max_user_id is not null and length(trim(max_user_id)) > 0)
  )
);

create unique index if not exists uq_festival_ugc_bans_profile
  on public.festival_ugc_bans (festival_id, shop_id, profile_id)
  where profile_id is not null;
create unique index if not exists uq_festival_ugc_bans_telegram
  on public.festival_ugc_bans (festival_id, shop_id, telegram_id)
  where telegram_id is not null;
create unique index if not exists uq_festival_ugc_bans_max
  on public.festival_ugc_bans (festival_id, shop_id, max_user_id)
  where max_user_id is not null;

create index if not exists idx_festival_ugc_bans_festival_shop
  on public.festival_ugc_bans (festival_id, shop_id, is_active);
