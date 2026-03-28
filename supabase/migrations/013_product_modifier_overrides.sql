create table if not exists public.product_modifier_group_overrides (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  is_disabled boolean not null default false,
  disabled_option_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (product_id, group_id)
);

create index if not exists idx_product_modifier_group_overrides_product_id
  on public.product_modifier_group_overrides(product_id);

alter table public.product_modifier_group_overrides enable row level security;

drop policy if exists product_modifier_group_overrides_select_tenant on public.product_modifier_group_overrides;
create policy product_modifier_group_overrides_select_tenant
  on public.product_modifier_group_overrides
  for select
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id and p.shop_id = public.current_shop_id()
    )
  );

drop policy if exists product_modifier_group_overrides_insert_tenant on public.product_modifier_group_overrides;
create policy product_modifier_group_overrides_insert_tenant
  on public.product_modifier_group_overrides
  for insert
  with check (
    exists (
      select 1
      from public.products p
      where p.id = product_id and p.shop_id = public.current_shop_id()
    )
  );

drop policy if exists product_modifier_group_overrides_update_tenant on public.product_modifier_group_overrides;
create policy product_modifier_group_overrides_update_tenant
  on public.product_modifier_group_overrides
  for update
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id and p.shop_id = public.current_shop_id()
    )
  );

drop policy if exists product_modifier_group_overrides_delete_tenant on public.product_modifier_group_overrides;
create policy product_modifier_group_overrides_delete_tenant
  on public.product_modifier_group_overrides
  for delete
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id and p.shop_id = public.current_shop_id()
    )
  );
