-- Outgoing review prompts (Telegram / Max) after order completion; separate from shop_reviews row until user rates.

create table if not exists public.shop_order_review_prompts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  channel text not null check (channel in ('telegram', 'max')),
  public_token text not null,
  status text not null default 'awaiting_send'
    check (status in ('awaiting_send', 'sent', 'send_failed', 'completed', 'expired')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz,
  last_error text,
  trigger_kind text not null default 'auto' check (trigger_kind in ('auto', 'manual')),
  created_by_profile_id uuid,
  customer_telegram_id bigint,
  customer_max_user_id text,
  max_conversation_id text,
  telegram_chat_id text,
  telegram_message_id text,
  max_message_id text,
  review_id uuid references public.shop_reviews(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_shop_order_review_prompts_order_channel unique (order_id, channel),
  constraint uq_shop_order_review_prompts_public_token unique (public_token)
);

create index if not exists idx_shop_order_review_prompts_due
  on public.shop_order_review_prompts (status, scheduled_for asc)
  where status = 'awaiting_send';

create index if not exists idx_shop_order_review_prompts_shop_order
  on public.shop_order_review_prompts (shop_id, order_id);

comment on table public.shop_order_review_prompts is 'Scheduled DM to rate order; public_token in Telegram callback_data / Max startapp.';
