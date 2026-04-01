# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- TypeScript 5.6.x - fullstack Nuxt app in `server/`, `pages/`, `middleware/`, `utils/`, `nuxt.config.ts`, `tailwind.config.ts`.

**Secondary:**
- SQL (PostgreSQL/Supabase migrations) - schema and data changes in `supabase/migrations/*.sql`.
- Markdown - product/architecture/payment docs in `docs/*.md`.

## Runtime

**Environment:**
- Node.js (version pinned in repo: Not detected). Runtime requirement documented as 18+ in `README.md`.
- Nuxt/Nitro server runtime via `nuxt dev`, `nuxt build`, `nuxt preview` in `package.json`.

**Package Manager:**
- npm (lockfile-based workflow).
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- Nuxt 3.14.x - app framework and server API routes (`nuxt`, `server/api/*`) in `package.json`.
- Vue 3.5.x - UI layer (`pages/*.vue`, `components/*.vue`) in `package.json`.
- Pinia 2.2.x - state management (`@pinia/nuxt`, `pinia`) in `package.json`.

**Testing:**
- Not detected (no Jest/Vitest/Playwright config or test files found in repository root patterns).

**Build/Dev:**
- Nuxt CLI - build/dev/generate/preview scripts in `package.json`.
- Tailwind CSS module (`@nuxtjs/tailwindcss`) configured in `nuxt.config.ts`.

## Key Dependencies

**Critical:**
- `@nuxtjs/supabase` 2.0.x - Nuxt module + server helpers (`serverSupabaseServiceRole`, `serverSupabaseUser`) used in `server/api/order.post.ts`, `server/api/checkout/create.post.ts`, `server/utils/tenant.ts`.
- `@supabase/supabase-js` 2.99.x - Supabase client dependency for DB/auth integration declared in `package.json`.
- `nuxt` 3.14.x - runtime and server framework for all routes.

**Infrastructure:**
- `qrcode` 1.5.x - QR-related functionality dependency declared in `package.json`.
- Telegram Web App SDK script loaded in `nuxt.config.ts` (`https://telegram.org/js/telegram-web-app.js`).

## Configuration

**Environment:**
- Runtime configuration defined in `nuxt.config.ts` under `runtimeConfig` and `runtimeConfig.public`.
- Billing/payment-related env names are present in code/docs: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_APP_URL`, `NUXT_BOT_TOKEN`, `NUXT_MANAGER_CHAT_ID`.
- `.env.example` exists and documents required variables.

**Build:**
- `nuxt.config.ts` - module wiring and runtime config.
- `tsconfig.json` - TypeScript project configuration.
- `tailwind.config.ts` - Tailwind configuration.

## Platform Requirements

**Development:**
- Node.js 18+ and npm (documented in `README.md`).
- Supabase project with migrations from `supabase/migrations`.

**Production:**
- Vercel deployment model documented in `README.md` and `docs/VERCEL_SUPABASE_TEST_PROD.md`.
- Separate staging/production environments documented in `docs/VERCEL_SUPABASE_TEST_PROD.md`.

---

*Stack analysis: 2026-04-01*
