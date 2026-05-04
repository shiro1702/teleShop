-- Группы категорий витрины: несколько категорий меню (например «Вино», «Пиво») под одним заголовком в каталоге («Алкогольные напитки»).

create table if not exists public.menu_category_groups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menu_category_groups_shop_sort
  on public.menu_category_groups (shop_id, sort_order);

alter table public.categories
  add column if not exists menu_group_id uuid references public.menu_category_groups(id) on delete set null;

create index if not exists idx_categories_menu_group_id on public.categories (menu_group_id);

comment on table public.menu_category_groups is 'Display groups: merge multiple menu categories under one catalog section / nav chip';
comment on column public.categories.menu_group_id is 'If set, category is shown inside this group on the storefront';

alter table public.menu_category_groups enable row level security;

drop policy if exists menu_category_groups_select_tenant on public.menu_category_groups;
create policy menu_category_groups_select_tenant on public.menu_category_groups
  for select using (shop_id = public.current_shop_id());

drop policy if exists menu_category_groups_insert_tenant on public.menu_category_groups;
create policy menu_category_groups_insert_tenant on public.menu_category_groups
  for insert with check (shop_id = public.current_shop_id());

drop policy if exists menu_category_groups_update_tenant on public.menu_category_groups;
create policy menu_category_groups_update_tenant on public.menu_category_groups
  for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

drop policy if exists menu_category_groups_delete_tenant on public.menu_category_groups;
create policy menu_category_groups_delete_tenant on public.menu_category_groups
  for delete using (shop_id = public.current_shop_id());
