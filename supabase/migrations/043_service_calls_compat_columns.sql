alter table public.service_calls
  add column if not exists customer_max_user_id text,
  add column if not exists customer_max_conversation_id text,
  add column if not exists source_channel text not null default 'chat',
  add column if not exists idempotency_key text,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_calls_source_channel_check'
  ) then
    alter table public.service_calls
      add constraint service_calls_source_channel_check
      check (source_channel in ('chat', 'web'));
  end if;
end $$;
