# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Nuxt monolith with server-routed modular domains (tenant routing, order checkout, payments webhook, dashboard backoffice, Supabase persistence).

**Key Characteristics:**
- Tenant isolation is resolved before handlers via `server/middleware/tenant.ts` and propagated as `event.context.tenant`.
- Payment architecture is split by intent: implemented B2C order payments (`YooKassa`) in code, and documented B2B SaaS billing as target state in `docs/SAAS_BILLING_RU.md`.
- Source-of-truth for payment completion is provider webhook, while client redirect is UX-only (`docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `server/api/webhooks/yookassa.post.ts`).

## Layers

**Routing and Request Context Layer:**
- Purpose: Resolve tenant/shop context and enforce cross-route request boundaries.
- Location: `server/middleware/tenant.ts`, `middleware/redirect-city.global.ts`, `middleware/dashboard-auth.global.ts`.
- Contains: Host/path-based tenant resolver, city-root redirect policy, dashboard auth guards.
- Depends on: `server/utils/tenant.ts`, runtime config in `nuxt.config.ts`.
- Used by: All server API handlers and storefront/dashboard routes.

**API Domain Layer (Nitro server routes):**
- Purpose: Execute checkout, order lifecycle, dashboard operations, and webhooks.
- Location: `server/api/**` (notably `server/api/order.post.ts`, `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`).
- Contains: Typed request handlers, Supabase queries, Telegram notifications, payment calls.
- Depends on: Tenant utilities, payment utilities, Supabase service-role client.
- Used by: Storefront pages (`pages/checkout.vue`, `pages/[city_slug]/[tenant_slug]/checkout.vue`), dashboard pages, provider callbacks.

**Integration/Adapter Layer:**
- Purpose: Isolate provider-specific protocols and external API payload mapping.
- Location: `server/utils/yookassa.ts`, `server/utils/tenant.ts`.
- Contains: YooKassa payment creation with idempotence key, tenant lookup and caching.
- Depends on: External HTTP APIs and Supabase data schema.
- Used by: Checkout and webhook handlers.

**Persistence and Schema Layer:**
- Purpose: Store multi-tenant entities, order/payment state, and migration history.
- Location: `supabase/migrations/*.sql` (payments: `supabase/migrations/018_payments_and_requisites.sql`, city scoping: `supabase/migrations/008_cities_city_id.sql`).
- Contains: `orders`, `order_payment_intents`, `payment_webhook_events`, `shops`, `restaurants`, `cities` columns/constraints/indexes/triggers.
- Depends on: PostgreSQL/Supabase.
- Used by: All server handlers and dashboard/storefront data APIs.

**Documentation Contract Layer:**
- Purpose: Define target billing/payment behavior and business policies.
- Location: `docs/TERMS.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/SAAS_BILLING_RU.md`, `docs/MULTI_TENANT_SAAS.md`.
- Contains: B2C vs B2B split, plan model, webhook-first status policy, role/tenant semantics.
- Depends on: Product policy decisions.
- Used by: Implementation planning and future API/schema work.

## Data Flow

**B2C Online Checkout Flow (implemented):**
1. Client creates order via `POST /api/order` in `server/api/order.post.ts`; server recomputes totals and stores `orders` row (`payment_status` pending for online).
2. Client requests payment link via `POST /api/checkout/create` in `server/api/checkout/create.post.ts`; handler resolves tenant YooKassa keys from `shops` and creates provider payment via `server/utils/yookassa.ts`.
3. Handler stores intent in `order_payment_intents`, updates `orders.payment_provider/payment_id/payment_status`, and returns `confirmationUrl`.
4. YooKassa sends callback to `POST /api/webhooks/yookassa`; `server/api/webhooks/yookassa.post.ts` persists `payment_webhook_events`, updates intent status, and sets final `orders.payment_status`.

**B2B SaaS Billing Flow (documented target, not detected in server routes):**
1. Owner starts billing checkout (`docs/SAAS_BILLING_RU.md`).
2. Platform merchant creates subscription payment.
3. Billing webhook updates subscription/payment state.
4. Access controls follow `trial/active/past_due/canceled` lifecycle policy.

**State Management:**
- Server-side state is persisted in Supabase tables and resolved per request; there is no separate event bus/state store detected for billing.
- Client state is view/UI orchestration; authoritative payment state remains in DB and webhook events.

## Key Abstractions

**Tenant Context (`event.context.tenant`):**
- Purpose: Canonical per-request organization context.
- Examples: `server/middleware/tenant.ts`, `server/utils/tenant.ts`, `server/api/checkout/create.post.ts`.
- Pattern: Resolve once in middleware, reuse in handlers (`requireTenantShop`).

**Payment Intent + Webhook Event Pair:**
- Purpose: Track outbound payment creation and inbound payment status confirmation.
- Examples: `order_payment_intents` and `payment_webhook_events` from `supabase/migrations/018_payments_and_requisites.sql`.
- Pattern: Persist intent on create, persist event on callback, apply idempotent status update.

**City-Aware Storefront Routing:**
- Purpose: Keep storefront scoped by city slug while preserving tenant isolation.
- Examples: `middleware/redirect-city.global.ts`, `pages/[city_slug]/**`, `supabase/migrations/008_cities_city_id.sql`.
- Pattern: Redirect `/` to default city + city-linked relational columns in DB.

## Entry Points

**Storefront Order Submission:**
- Location: `server/api/order.post.ts`.
- Triggers: Checkout submit from storefront pages (`pages/checkout.vue`, `pages/[city_slug]/[tenant_slug]/checkout.vue`).
- Responsibilities: Validate tenant and restaurant, recompute totals, create order, notify Telegram.

**Payment Session Creation:**
- Location: `server/api/checkout/create.post.ts`.
- Triggers: Online-payment CTA after order creation.
- Responsibilities: Validate order state, resolve merchant credentials, call provider, save intent.

**Payment Status Reconciliation:**
- Location: `server/api/webhooks/yookassa.post.ts`.
- Triggers: Provider webhook delivery.
- Responsibilities: Deduplicate event, map provider status to local order status, mark event processed.

## Error Handling

**Strategy:** Fail-fast server errors with HTTP status codes and DB-backed idempotency where needed.

**Patterns:**
- Validation and domain rejections use `createError({ statusCode, statusMessage/message })` in handlers like `server/api/order.post.ts` and `server/api/checkout/create.post.ts`.
- Duplicate webhook deliveries are handled by unique constraint on `(provider, event_id)` and treated as successful no-op in `server/api/webhooks/yookassa.post.ts`.

## Cross-Cutting Concerns

**Logging:** Minimal inline logging through `console.error` in API handlers (`server/api/order.post.ts`, `server/api/client-order-status.get.ts`).
**Validation:** Request-level type narrowing and business checks in route handlers; schema-level constraints in migrations.
**Authentication:** Tenant scoping through middleware and utility checks; dashboard role checks via `requireDashboardAccess` (example `server/api/dashboard/storefront.get.ts`).
**Secrets Boundary:** Runtime config and server-side DB columns used for secrets (`nuxt.config.ts`, `shops.yookassa_secret_key` from `supabase/migrations/018_payments_and_requisites.sql`); UI-only docs specify masking policies (`docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/MULTI_TENANT_SAAS.md`).

---

*Architecture analysis: 2026-04-01*
