# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```text
teleShop/
├── docs/                 # Product and architecture contracts (billing, payments, multi-tenant terms)
├── server/               # Nitro API, middleware, and integration utilities
├── pages/                # Storefront, dashboard, platform-admin route views
├── middleware/           # Nuxt route middleware (city redirect, dashboard auth)
├── supabase/migrations/  # SQL schema evolution for tenant, city, orders, payments
├── layouts/              # UI layout split (default vs dashboard)
├── composables/          # Frontend reusable logic (dashboard access, etc.)
├── utils/                # Shared frontend helpers
└── .planning/codebase/   # Codebase mapping docs consumed by GSD workflow
```

## Directory Purposes

**`docs/`:**
- Purpose: Defines product contracts and implementation targets for billing/payments and tenant model.
- Contains: Architecture docs and operational rules.
- Key files: `docs/TERMS.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/SAAS_BILLING_RU.md`, `docs/MULTI_TENANT_SAAS.md`.

**`server/api/`:**
- Purpose: Server endpoints for order lifecycle, checkout/payment, webhooks, dashboard data.
- Contains: Route handlers grouped by domain and dashboard namespaces.
- Key files: `server/api/order.post.ts`, `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`, `server/api/dashboard/orders/index.get.ts`, `server/api/dashboard/storefront.get.ts`.

**`server/middleware/` and `middleware/`:**
- Purpose: Enforce tenant/city/dashboard request behavior before page/API logic.
- Contains: Server middleware and Nuxt route middleware.
- Key files: `server/middleware/tenant.ts`, `middleware/redirect-city.global.ts`, `middleware/dashboard-auth.global.ts`.

**`server/utils/`:**
- Purpose: Integration adapters and shared domain helpers for API routes.
- Contains: Tenant resolver/cache, YooKassa adapter, dashboard helpers.
- Key files: `server/utils/tenant.ts`, `server/utils/yookassa.ts`.

**`supabase/migrations/`:**
- Purpose: Authoritative database schema history.
- Contains: SQL migrations for multi-tenant entities, city scoping, orders, and payments.
- Key files: `supabase/migrations/008_cities_city_id.sql`, `supabase/migrations/018_payments_and_requisites.sql`.

**`pages/`:**
- Purpose: Route-driven UI modules for storefront and operational dashboard.
- Contains: City-aware storefront routes, legacy tenant routes, dashboard and platform pages.
- Key files: `pages/[city_slug]/[tenant_slug]/checkout.vue`, `pages/checkout.vue`, `pages/dashboard/integrations.vue`, `pages/platform/cities.vue`.

## Key File Locations

**Entry Points:**
- `nuxt.config.ts`: App runtime config, module registration, environment boundaries.
- `server/middleware/tenant.ts`: Tenant resolution and request context injection.
- `server/api/order.post.ts`: Primary order creation entry point.
- `server/api/checkout/create.post.ts`: Payment-session creation entry point.
- `server/api/webhooks/yookassa.post.ts`: Provider callback entry point.

**Configuration:**
- `package.json`: Runtime scripts and dependency manifest.
- `nuxt.config.ts`: Runtime keys and public/server config split.
- `tailwind.config.ts`: Tailwind setup.

**Core Logic:**
- `server/utils/tenant.ts`: Tenant lookup, caching, and shop/restaurant assertions.
- `server/utils/yookassa.ts`: Provider request composition and API call.
- `server/api/client-order-status.get.ts`: Client-visible order status with tenant checks.

**Testing:**
- Not detected: no dedicated `*.test.*`/`*.spec.*` suite or test runner config files in current repository root.

## Naming Conventions

**Files:**
- API handlers use Nitro suffix format: `*.get.ts`, `*.post.ts`, `*.put.ts` under `server/api/`.
- Middleware uses `.global.ts` for globally applied route middleware in `middleware/`.
- Docs use uppercase topical names in `docs/` (for example `SAAS_BILLING_RU.md`).

**Directories:**
- Route-param directories follow Nuxt dynamic segments: `[city_slug]`, `[tenant_slug]`, `[id]`.
- Dashboard APIs are grouped by business area: `server/api/dashboard/orders/`, `server/api/dashboard/menu/`, `server/api/dashboard/branches/`.

## Where to Add New Code

**New Billing/Payment Feature (server-side):**
- Primary code: `server/api/billing/` for B2B endpoints and/or `server/api/webhooks/billing/` for billing callbacks (path currently not detected; create new modules there to keep parity with existing payment API grouping).
- Shared provider logic: `server/utils/` (for example, new adapter alongside `server/utils/yookassa.ts`).
- DB schema changes: new SQL migration in `supabase/migrations/` with next sequential prefix.
- Documentation contract updates: `docs/SAAS_BILLING_RU.md` and `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`.

**New Storefront Billing UI or Payment UX:**
- City-aware storefront pages: `pages/[city_slug]/[tenant_slug]/...` (primary canonical path).
- Legacy compatibility pages: `pages/[tenant_slug]/...` only if backward-compatible route is required.

**Dashboard Integration/Billing Screens:**
- Implementation: `pages/dashboard/integrations.vue` or new `pages/dashboard/billing/*.vue`.
- Data endpoints: matching handlers in `server/api/dashboard/`.

**Utilities:**
- Tenant-aware server helpers: `server/utils/`.
- Frontend pure helpers: `utils/`.
- Shared page logic: `composables/`.

## Special Directories

**`supabase/migrations/`:**
- Purpose: SQL migration source of truth.
- Generated: No.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: GSD mapping/reference docs for planning and execution agents.
- Generated: Semi-generated by mapping tasks.
- Committed: Typically yes in GSD workflow.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2026-04-01*
