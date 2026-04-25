create table if not exists public.festivals (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  slug text not null,
  name text not null,
  description text null,
  pulse_stats jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_festivals_city_slug
  on public.festivals (city_id, slug);

create index if not exists idx_festivals_active_window
  on public.festivals (city_id, is_active, starts_at, ends_at);

alter table public.restaurants
  add column if not exists festival_id uuid null references public.festivals(id) on delete set null,
  add column if not exists is_festival boolean not null default false;

create index if not exists idx_restaurants_city_festival_mode
  on public.restaurants (city_id, is_active, is_festival);

create index if not exists idx_restaurants_festival_id
  on public.restaurants (festival_id);
