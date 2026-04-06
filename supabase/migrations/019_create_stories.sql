-- Stories: campaigns, slides, views + optional profile fields for targeting

alter table public.profiles
  add column if not exists gender text,
  add column if not exists birth_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_gender_check'
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('male', 'female', 'other'));
  end if;
end $$;

create table if not exists public.story_campaigns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  preview_url text,
  placement text not null check (placement in ('top_bar', 'catalog_grid')),
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  targeting jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_story_campaigns_shop_active on public.story_campaigns (shop_id, is_active);
create index if not exists idx_story_campaigns_shop_placement on public.story_campaigns (shop_id, placement);

create table if not exists public.story_slides (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.story_campaigns(id) on delete cascade,
  sort_order integer not null default 0,
  media_url text not null,
  duration_seconds integer not null default 5 check (duration_seconds >= 1 and duration_seconds <= 120),
  action_type text not null default 'none' check (
    action_type in ('add_to_cart', 'apply_promo', 'open_category', 'none')
  ),
  action_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_story_slides_campaign_sort on public.story_slides (campaign_id, sort_order);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.story_slides(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_story_views_slide_viewed on public.story_views (slide_id, viewed_at desc);
create index if not exists idx_story_views_user on public.story_views (user_id, viewed_at desc);

alter table public.story_campaigns enable row level security;
alter table public.story_slides enable row level security;
alter table public.story_views enable row level security;

drop policy if exists story_campaigns_select_tenant on public.story_campaigns;
drop policy if exists story_campaigns_insert_tenant on public.story_campaigns;
drop policy if exists story_campaigns_update_tenant on public.story_campaigns;
drop policy if exists story_campaigns_delete_tenant on public.story_campaigns;

create policy story_campaigns_select_tenant
  on public.story_campaigns for select
  using (shop_id = public.current_shop_id());

create policy story_campaigns_insert_tenant
  on public.story_campaigns for insert
  with check (shop_id = public.current_shop_id());

create policy story_campaigns_update_tenant
  on public.story_campaigns for update
  using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

create policy story_campaigns_delete_tenant
  on public.story_campaigns for delete
  using (shop_id = public.current_shop_id());

drop policy if exists story_slides_select_tenant on public.story_slides;
drop policy if exists story_slides_insert_tenant on public.story_slides;
drop policy if exists story_slides_update_tenant on public.story_slides;
drop policy if exists story_slides_delete_tenant on public.story_slides;

create policy story_slides_select_tenant
  on public.story_slides for select
  using (
    exists (
      select 1 from public.story_campaigns c
      where c.id = story_slides.campaign_id and c.shop_id = public.current_shop_id()
    )
  );

create policy story_slides_insert_tenant
  on public.story_slides for insert
  with check (
    exists (
      select 1 from public.story_campaigns c
      where c.id = story_slides.campaign_id and c.shop_id = public.current_shop_id()
    )
  );

create policy story_slides_update_tenant
  on public.story_slides for update
  using (
    exists (
      select 1 from public.story_campaigns c
      where c.id = story_slides.campaign_id and c.shop_id = public.current_shop_id()
    )
  );

create policy story_slides_delete_tenant
  on public.story_slides for delete
  using (
    exists (
      select 1 from public.story_campaigns c
      where c.id = story_slides.campaign_id and c.shop_id = public.current_shop_id()
    )
  );

drop policy if exists story_views_select_tenant on public.story_views;
drop policy if exists story_views_insert_tenant on public.story_views;

create policy story_views_select_tenant
  on public.story_views for select
  using (
    exists (
      select 1 from public.story_slides s
      join public.story_campaigns c on c.id = s.campaign_id
      where s.id = story_views.slide_id and c.shop_id = public.current_shop_id()
    )
  );

create policy story_views_insert_tenant
  on public.story_views for insert
  with check (
    exists (
      select 1 from public.story_slides s
      join public.story_campaigns c on c.id = s.campaign_id
      where s.id = story_views.slide_id and c.shop_id = public.current_shop_id()
    )
  );
