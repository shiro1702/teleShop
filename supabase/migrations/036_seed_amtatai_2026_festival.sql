insert into public.festivals (
  city_id,
  slug,
  name,
  description,
  pulse_stats,
  schedule,
  starts_at,
  ends_at,
  is_active
)
select
  c.id,
  'amtatai-2026',
  'Амтатай 2026',
  'Фестиваль Амтатай 2026. Адрес: Улан-Удэ, Пионер 2.',
  jsonb_build_object(
    'Съедено бууз', 0,
    'Среднее время выдачи (мин)', 0
  ),
  jsonb_build_array(
    '22 мая 2026 — открытие',
    '26 мая 2026 — закрытие',
    'Адрес: Улан-Удэ, Пионер 2'
  ),
  '2026-05-22 00:00:00+08'::timestamptz,
  '2026-05-26 23:59:59+08'::timestamptz,
  true
from public.cities c
where c.slug = 'ulan-ude'
on conflict (city_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  pulse_stats = excluded.pulse_stats,
  schedule = excluded.schedule,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  is_active = excluded.is_active,
  updated_at = now();
