alter table if exists public.restaurants
  add column if not exists use_organization_working_hours boolean not null default true;

alter table if exists public.restaurants
  add column if not exists working_hours jsonb;
