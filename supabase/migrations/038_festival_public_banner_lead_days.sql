alter table public.festivals
  add column if not exists public_banner_lead_days integer not null default 35
  check (public_banner_lead_days >= 0);

update public.festivals
set public_banner_lead_days = 35
where slug = 'amtatai-2026';
