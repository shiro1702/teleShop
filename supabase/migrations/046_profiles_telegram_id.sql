-- Telegram login: ensure profiles.telegram_id exists (was only in supabase-telegram-link.sql for some projects).
-- Уникальность по желанию: если в таблице уже есть дубликаты telegram_id, отдельный unique index не применять без очистки данных.

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists telegram_id bigint;
  end if;
end $$;
