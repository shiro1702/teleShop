create table if not exists public.customer_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_profile_id uuid not null references public.profiles(id) on delete cascade,
  address_line text not null,
  flat text null,
  comment text null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_delivery_addresses_shop_profile_last_used_idx
  on public.customer_delivery_addresses (shop_id, customer_profile_id, last_used_at desc);

create or replace function public.set_customer_delivery_addresses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customer_delivery_addresses_updated_at on public.customer_delivery_addresses;
create trigger trg_customer_delivery_addresses_updated_at
before update on public.customer_delivery_addresses
for each row execute function public.set_customer_delivery_addresses_updated_at();
