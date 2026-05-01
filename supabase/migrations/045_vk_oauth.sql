-- VK ID OAuth (PKCE): pending tokens + profile linkage

alter table public.auth_tokens
  add column if not exists vk_user_id text,
  add column if not exists vk_state text,
  add column if not exists vk_code_verifier text,
  add column if not exists vk_device_id text;

create unique index if not exists idx_auth_tokens_vk_state_unique
  on public.auth_tokens (vk_state)
  where vk_state is not null;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists vk_user_id text,
      add column if not exists vk_email text,
      add column if not exists vk_phone text;
  end if;
end $$;

create unique index if not exists idx_profiles_vk_user_id_unique
  on public.profiles (vk_user_id)
  where vk_user_id is not null;
