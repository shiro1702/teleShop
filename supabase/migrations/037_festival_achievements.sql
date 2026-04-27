create table if not exists public.festival_achievements (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  max_progress integer not null default 1,
  points integer not null default 0,
  icon_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_festival_achievements_code
  on public.festival_achievements (festival_id, code);

create table if not exists public.user_festival_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.festival_achievements(id) on delete cascade,
  progress integer not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_user_festival_achievements
  on public.user_festival_achievements (user_id, achievement_id);

-- Create some default achievements for Amtatai 2026
insert into public.festival_achievements (
  festival_id,
  code,
  title,
  description,
  max_progress,
  points
)
select
  f.id,
  a.code,
  a.title,
  a.description,
  a.max_progress,
  a.points
from public.festivals f
cross join (
  values
    ('gastro-tourist', 'Гастро-турист (Бронза)', 'Сделайте заказы в 3 разных корнерах.', 3, 100),
    ('ambassador', 'Амбассадор категории', 'Сделайте 3 заказа в заведениях одной категории.', 3, 100),
    ('sweet-life', 'Сладкая жизнь', 'Закажите 2 десерта или кофе за один день.', 2, 50),
    ('pack-feeder', 'Кормилец стаи', 'Соберите чек из 5 и более позиций за один заказ.', 1, 150),
    ('bottomless', 'Бездонный желудок', 'Сделайте 5 любых заказов за один день.', 5, 200),
    ('early-bird', 'Ранняя пташка', 'Сделайте заказ до 12:00.', 1, 50),
    ('night-eater', 'Ночной дожор', 'Сделайте заказ за час до закрытия фестиваля.', 1, 50),
    ('flash', 'Флэш', 'Заберите заказ со стойки менее чем за 1 минуту после пуша «Готово».', 1, 100),
    ('critic', 'Ресторанный критик', 'Поставьте оценки 3 разным заведениям после заказа.', 3, 150),
    ('legend', 'Легенда Фестиваля', 'Соберите 5 любых других достижений.', 5, 1000)
) as a(code, title, description, max_progress, points)
where f.slug = 'amtatai-2026'
on conflict (festival_id, code) do update
set
  title = excluded.title,
  description = excluded.description,
  max_progress = excluded.max_progress,
  points = excluded.points,
  updated_at = now();
