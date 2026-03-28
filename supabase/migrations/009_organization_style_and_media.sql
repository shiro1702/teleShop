create table if not exists public.organization_style_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  prev_config jsonb,
  audit_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_style_presets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  mood text not null default '',
  config jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_org_style_presets_shop_title
  on public.organization_style_presets (shop_id, lower(title));

create index if not exists idx_org_style_presets_shop_created
  on public.organization_style_presets (shop_id, created_at desc);

alter table public.organization_style_settings enable row level security;
drop policy if exists organization_style_settings_select_tenant on public.organization_style_settings;
drop policy if exists organization_style_settings_insert_tenant on public.organization_style_settings;
drop policy if exists organization_style_settings_update_tenant on public.organization_style_settings;
create policy organization_style_settings_select_tenant
  on public.organization_style_settings
  for select
  using (shop_id = public.current_shop_id());
create policy organization_style_settings_insert_tenant
  on public.organization_style_settings
  for insert
  with check (shop_id = public.current_shop_id());
create policy organization_style_settings_update_tenant
  on public.organization_style_settings
  for update
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

alter table public.organization_style_presets enable row level security;
drop policy if exists organization_style_presets_select_tenant on public.organization_style_presets;
drop policy if exists organization_style_presets_insert_tenant on public.organization_style_presets;
drop policy if exists organization_style_presets_update_tenant on public.organization_style_presets;
drop policy if exists organization_style_presets_delete_tenant on public.organization_style_presets;
create policy organization_style_presets_select_tenant
  on public.organization_style_presets
  for select
  using (shop_id = public.current_shop_id());
create policy organization_style_presets_insert_tenant
  on public.organization_style_presets
  for insert
  with check (shop_id = public.current_shop_id());
create policy organization_style_presets_update_tenant
  on public.organization_style_presets
  for update
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());
create policy organization_style_presets_delete_tenant
  on public.organization_style_presets
  for delete
  using (shop_id = public.current_shop_id());

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('organization-media', 'organization-media', true)
  on conflict (id) do nothing;
exception
  when undefined_table then
    null;
end $$;

do $$
begin
  drop policy if exists organization_media_public_read on storage.objects;
  create policy organization_media_public_read
    on storage.objects
    for select
    using (bucket_id = 'organization-media');

  drop policy if exists organization_media_insert_tenant on storage.objects;
  create policy organization_media_insert_tenant
    on storage.objects
    for insert
    with check (
      bucket_id = 'organization-media'
      and auth.role() = 'authenticated'
      and split_part(name, '/', 1) = public.current_shop_id()::text
    );

  drop policy if exists organization_media_update_tenant on storage.objects;
  create policy organization_media_update_tenant
    on storage.objects
    for update
    using (
      bucket_id = 'organization-media'
      and auth.role() = 'authenticated'
      and split_part(name, '/', 1) = public.current_shop_id()::text
    )
    with check (
      bucket_id = 'organization-media'
      and auth.role() = 'authenticated'
      and split_part(name, '/', 1) = public.current_shop_id()::text
    );

  drop policy if exists organization_media_delete_tenant on storage.objects;
  create policy organization_media_delete_tenant
    on storage.objects
    for delete
    using (
      bucket_id = 'organization-media'
      and auth.role() = 'authenticated'
      and split_part(name, '/', 1) = public.current_shop_id()::text
    );
exception
  when undefined_table then
    null;
end $$;
