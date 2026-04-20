alter table public.categories
  add column if not exists delivery_restricted boolean not null default false,
  add column if not exists availability_windows jsonb not null default '[]'::jsonb;

alter table public.products
  add column if not exists delivery_restricted_override boolean,
  add column if not exists availability_windows jsonb not null default '[]'::jsonb;

comment on column public.categories.delivery_restricted is 'If true, category items are not available for delivery';
comment on column public.products.delivery_restricted_override is 'null=inherited from category, true=restricted, false=explicitly allowed';
comment on column public.categories.availability_windows is 'Array of {days:number[],start:HH:MM,end:HH:MM}';
comment on column public.products.availability_windows is 'Array of {days:number[],start:HH:MM,end:HH:MM}; overrides category when non-empty';
