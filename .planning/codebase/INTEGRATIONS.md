# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Payments (implemented):**
- YooKassa - online payment creation and webhook status sync for B2C order flow.
  - SDK/Client: custom HTTP client in `server/utils/yookassa.ts` (POST `https://api.yookassa.ru/v3/payments`).
  - Auth: per-shop credentials from `shops.yookassa_shop_id` / `shops.yookassa_secret_key` and `shops.integration_keys` in `server/api/checkout/create.post.ts`, `server/utils/tenant.ts`.

**Payments (documented target, not detected in runtime code):**
- T-Bank acquiring - architecture and target contracts documented in `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`.
  - SDK/Client: Not detected in code.
  - Auth: documented concept only in docs; env/schema wiring not detected in server routes.

**Messaging:**
- Telegram Bot API - order notifications, status callbacks, login/link flows in `server/api/order.post.ts` and `server/api/webhook.post.ts`.
  - SDK/Client: direct HTTP calls (`https://api.telegram.org/bot...`) in `server/api/webhook.post.ts`.
  - Auth: `NUXT_BOT_TOKEN` fallback plus tenant-level bot token in `shops.telegram_bot_token` via `server/utils/tenant.ts`.

**Maps/Address:**
- Yandex Maps and Yandex Geocoder - keys configured in `nuxt.config.ts`.
  - SDK/Client: key plumbing detected; concrete provider calls are outside payment-focused files.
  - Auth: `YANDEX_MAPS_API_KEY`, `YANDEX_GEOCODER_API_KEY`.

**Address suggestions:**
- DaData - token wiring exists in runtime config (`nuxt.config.ts`), usage path referenced in docs.
  - SDK/Client: token consumption referenced in `docs/VERCEL_SUPABASE_TEST_PROD.md`.
  - Auth: `DADATA_TOKEN`.

## Data Storage

**Databases:**
- Supabase Postgres.
  - Connection: `SUPABASE_URL`.
  - Client: `@nuxtjs/supabase` + server helpers (`serverSupabaseServiceRole`) in `server/api/*` and `server/utils/tenant.ts`.

**File Storage:**
- Not detected for billing/payment artifacts (no S3/GCS integration found).

**Caching:**
- In-memory process cache for tenant shop resolution in `server/utils/tenant.ts` (`Map` with TTL).

## Authentication & Identity

**Auth Provider:**
- Supabase Auth + Telegram identity linking.
  - Implementation: Supabase session checks via `serverSupabaseUser`, Telegram auth token bridge via `auth_tokens` flow in `server/api/webhook.post.ts` and auth endpoints in `server/api/auth/*`.

## Monitoring & Observability

**Error Tracking:**
- Dedicated SaaS error tracking service not detected.

**Logs:**
- Server logs via `console.error` in payment/order/webhook handlers (`server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`, `server/api/order.post.ts`, `server/api/webhook.post.ts`).

## CI/CD & Deployment

**Hosting:**
- Vercel (documented and referenced in `README.md`, `docs/VERCEL_SUPABASE_TEST_PROD.md`).

**CI Pipeline:**
- Explicit CI service configuration not detected in repository files.

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NUXT_APP_URL`
- `NUXT_BOT_TOKEN`
- `NUXT_MANAGER_CHAT_ID`
- `NUXT_SESSION_SECRET` (documented in `docs/VERCEL_SUPABASE_TEST_PROD.md`)
- Optional payment-adjacent: `YANDEX_MAPS_API_KEY`, `YANDEX_GEOCODER_API_KEY`, `DADATA_TOKEN`

**Secrets location:**
- Local development template in `.env.example`.
- Deployment secrets expected in Vercel Environment Variables (`docs/VERCEL_SUPABASE_TEST_PROD.md`).
- Tenant-level payment/telegram credentials stored in `shops` table columns and `shops.integration_keys` (`server/utils/tenant.ts`, `supabase/migrations/018_payments_and_requisites.sql`).

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/yookassa` - YooKassa payment status webhook handler in `server/api/webhooks/yookassa.post.ts`.
- `POST /api/webhook` - Telegram bot update webhook in `server/api/webhook.post.ts`.

**Outgoing:**
- Outbound payment creation request to YooKassa API in `server/utils/yookassa.ts`.
- Outbound Telegram Bot API calls (`sendMessage`, `editMessageText`, `answerCallbackQuery`) in `server/api/order.post.ts` and `server/api/webhook.post.ts`.

---

*Integration audit: 2026-04-01*
