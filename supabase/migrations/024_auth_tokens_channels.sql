alter table public.auth_tokens
  add column if not exists channel text not null default 'telegram',
  add column if not exists max_user_id text,
  add column if not exists max_conversation_id text;

create index if not exists idx_auth_tokens_channel_expires
  on public.auth_tokens (channel, expires_at desc);
