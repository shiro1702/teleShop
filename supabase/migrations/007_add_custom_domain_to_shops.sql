alter table public.shops
  add column if not exists custom_domain text;

create unique index if not exists idx_shops_custom_domain_unique
  on public.shops (custom_domain)
  where custom_domain is not null;
