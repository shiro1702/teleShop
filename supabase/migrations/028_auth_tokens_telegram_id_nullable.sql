-- Pending Telegram link tokens are created on the site before the user opens the bot.
alter table public.auth_tokens
  alter column telegram_id drop not null;

comment on column public.auth_tokens.telegram_id is
  'Set when the user confirms in Telegram; null until then for site-issued link tokens.';
