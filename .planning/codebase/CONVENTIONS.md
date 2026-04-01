# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Nuxt route files use filesystem routing with dynamic params in brackets, e.g. `pages/[city_slug]/[tenant_slug]/checkout.vue`, `pages/dashboard/orders/[id].vue`.
- Nitro API handlers follow method suffix naming, e.g. `server/api/checkout/create.post.ts`, `server/api/dashboard/orders/[id]/status.put.ts`, `server/api/cities.get.ts`.
- Utilities and composables use camelCase file names, e.g. `server/utils/yookassa.ts`, `server/utils/tenant.ts`, `composables/useDashboardAccess.ts`.
- Billing/payment docs use uppercase snake-like documentation naming, e.g. `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/MULTI_TENANT_SAAS.md`, `docs/TERMS.md`.

**Functions:**
- Functions use camelCase (`buildFallbackReturnUrl`, `createYooKassaPayment`, `requireTenantShop`).
- Server handlers use Nuxt/Nitro default export pattern with `defineEventHandler(...)` in `server/api/*`.

**Variables:**
- Local variables are camelCase (`shopId`, `providerPaymentId`, `nextOrderPaymentStatus`).
- Constants are UPPER_SNAKE_CASE for shared/static values (`CACHE_TTL_MS`, `UUID_RE`) in `server/utils/tenant.ts`.

**Types:**
- Type aliases use PascalCase with domain-specific names (`TenantShop`, `TenantRestaurantZone`, `YooKassaCreatePaymentResult`).
- Union literal types are used for permission/role sets in `composables/useDashboardAccess.ts`.

## Code Style

**Formatting:**
- No dedicated formatter config detected (`.prettierrc*`, `prettier.config.*` not detected).
- Style is currently enforced by consistent TypeScript/Vue conventions visible in `server/api/*`, `server/utils/*`, and `pages/*`.
- Indentation and syntax style are consistent with 2-space indentation and semicolon-light TS style in `nuxt.config.ts` and `server/api/checkout/create.post.ts`.

**Linting:**
- No ESLint/Biome config detected (`eslint.config.*`, `.eslintrc*`, `biome.json` not detected).
- Type strictness is enabled via `typescript.strict: true` in `nuxt.config.ts`.

## Import Organization

**Order:**
1. Node built-ins first (`import crypto from 'node:crypto'` in `server/api/checkout/create.post.ts`).
2. Framework/runtime imports (`h3`, `#supabase/server`).
3. Local aliased imports (`~/server/utils/*`).

**Path Aliases:**
- `~/*` alias is used for project-root imports (example: `~/server/utils/yookassa`).
- Nuxt virtual alias imports are used where needed (`#supabase/server`).

## Error Handling

**Patterns:**
- Server endpoints use `createError({ statusCode, statusMessage/message })` and throw early on validation failures in `server/api/checkout/create.post.ts` and `server/api/webhooks/yookassa.post.ts`.
- Database calls follow explicit `data/error` checking after Supabase queries across `server/api/*`.
- Client-side pages/composables use `try/catch` with fallback error messages (`pages/dashboard/index.vue`, `composables/useDashboardAccess.ts`).

## Logging

**Framework:** `console` (server-side)

**Patterns:**
- Logging is sparse and mostly used for exceptional DB lookup failures in `server/utils/tenant.ts`.
- Operational state is primarily persisted in DB tables (for example webhook events in `supabase/migrations/018_payments_and_requisites.sql`) instead of verbose runtime logs.

## Comments

**When to Comment:**
- Comments are used for intent/risk points, not line-by-line narration (for example duplicate webhook idempotency note in `server/api/webhooks/yookassa.post.ts`).
- Config comments document security boundaries (example in `nuxt.config.ts` for Supabase service key usage).

**JSDoc/TSDoc:**
- Full JSDoc usage is limited; short block comments appear for sensitive helper behavior (for example `assertShopIdMatchesTenant` in `server/utils/tenant.ts`).

## Function Design

**Size:** Moderate-sized handlers with guard clauses; longer orchestration functions are common in API routes (`server/api/checkout/create.post.ts`).

**Parameters:** Strongly typed input DTOs/type aliases for request body or utility inputs (`Body`, `CreateYooKassaPaymentInput`).

**Return Values:** API handlers return minimal JSON contracts with `ok` flags and payload fields; utility functions return typed objects.

## Module Design

**Exports:** Utilities prefer named exports (`createYooKassaPayment`, `requireTenantShop`); API routes use default export handler.

**Barrel Files:** Not detected; modules are imported directly by file path.

## SaaS Billing and Payment Documentation Conventions

- Treat B2B billing and B2C checkout as separate domains consistently across docs and code:
  - Docs: `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`
  - Code paths: `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`
- Keep terminology synchronized with `docs/TERMS.md` and domain model in `docs/MULTI_TENANT_SAAS.md` (`shop`, `restaurant`, dashboard wording).
- Use webhook-first payment truth model in implementation and docs:
  - Doc guidance in `docs/PAYMENTS_RU_YOOKASSA_TBANK.md` and `docs/SAAS_BILLING_RU.md`
  - Event persistence pattern in `payment_webhook_events` from `supabase/migrations/018_payments_and_requisites.sql`.

---

*Convention analysis: 2026-04-01*
