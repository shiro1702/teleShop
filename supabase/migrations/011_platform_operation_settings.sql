create table if not exists public.platform_operation_settings (
  id smallint primary key default 1,
  disabled_fulfillment_modes text[] not null default '{}'::text[],
  test_override_hosts text[] not null default array['localhost', '127.0.0.1']::text[],
  test_override_shop_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  constraint platform_operation_settings_singleton check (id = 1)
);

insert into public.platform_operation_settings (id)
values (1)
on conflict (id) do nothing;
