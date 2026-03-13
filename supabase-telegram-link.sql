-- Таблица profiles (расширение auth.users) и auth_tokens для одноразовых Telegram-токенов

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_on_profiles on public.profiles;

create trigger set_timestamp_on_profiles
before update on public.profiles
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can manage their profile'
  ) then
    create policy "Users can manage their profile"
      on public.profiles
      for all
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end$$;

create table if not exists public.auth_tokens (
  token uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

alter table public.auth_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'auth_tokens'
      and policyname = 'Service role can manage auth tokens'
  ) then
    create policy "Service role can manage auth tokens"
      on public.auth_tokens
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

