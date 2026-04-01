# Architecture Patterns

**Domain:** B2B QR-order SaaS for quick-service restaurants (brownfield Nuxt + Supabase)
**Researched:** 2026-04-01

## Recommended Architecture

Evolve the current Nuxt monolith into a **modular server-domain architecture inside one deployable**:

- Keep one Nuxt/Nitro runtime for speed of delivery.
- Enforce strict domain boundaries in `server/api/*`, `server/utils/*`, and SQL schema.
- Use **tenant context (`shop`) + branch context (`restaurant`)** as mandatory request scope.
- Keep **webhook-first payment truth** (already present for B2C) and mirror the same model for B2B billing.

High-level shape:

```text
Public Storefront (QR/city/tenant routes)
    -> Nitro API Gateway (tenant + auth middleware)
        -> Branch Catalog/Publishing Domain
        -> Checkout + B2C Payment Domain
        -> Orders Operations Domain
        -> Admin/RBAC Domain
        -> Billing (B2B) Domain
        -> Integrations Domain (YooKassa/T-Bank/Telegram)
            -> Supabase Postgres (RLS + constraints + audit/event tables)
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Tenant Resolution Layer | Resolve host/path to `shop`; attach tenant to request context | Storefront Router, API Gateway, Supabase |
| Storefront Router (QR + City + Tenant) | Route guest to branch-scoped menu and checkout (`/:city_slug/:tenant_slug/...`) | Tenant Resolution, Catalog, Checkout |
| Branch Storefront Domain | Build branch view from base menu + branch overrides; expose published catalog | Menu Publishing, Orders Domain |
| Menu Publishing Domain | Manage draft/published menu versions and branch-level overrides | Branch Storefront, Admin/RBAC, Supabase |
| Checkout + B2C Payments Domain | Create order intents, call provider, return confirmation URL, reconcile webhook | Orders Domain, Payment Provider Adapter, Supabase |
| Orders Operations Domain | Order lifecycle for kitchen/manager flows; payment status linkage | Checkout Domain, Admin Dashboard, Notifications |
| Admin/RBAC Domain | Owner/Manager roles, permission checks, branch scoping in dashboard actions | All protected dashboard APIs, Supabase membership tables |
| Billing (B2B SaaS) Domain | Subscription lifecycle (`trial/active/past_due/canceled`), grace policy, billing webhooks | Admin/RBAC, Provider Adapter, Supabase |
| Provider Adapter Layer | Isolate YooKassa/T-Bank API payloads, idempotency, signature verification | Checkout Domain, Billing Domain, Webhook Endpoints |
| Event/Audit Domain | Persist webhook events, billing events, critical admin actions | Payments, Billing, Admin/RBAC |

## Data Flow

### 1) Branch QR Storefront and Menu Publishing

1. Guest scans branch QR with branch context (`branch_id`/`restaurant_id` alias).
2. Storefront route resolves `city_slug + tenant_slug` and validates branch belongs to tenant.
3. Branch Storefront Domain composes menu from:
   - organization-level products (`shop`),
   - branch overrides (`restaurant`).
4. Only **published** menu snapshot is returned to storefront.

Key rule: storefront never reads unpublished menu drafts.

### 2) B2C Online Payment (branch orders)

1. Storefront submits order to `Orders Domain`; server recomputes totals.
2. Checkout Domain creates payment through Provider Adapter using tenant/branch merchant resolution:
   - MVP: `shop` credentials,
   - future: `restaurant` override with fallback to `shop`.
3. Intent is saved in `order_payment_intents`.
4. Client redirects to provider `confirmation_url`.
5. Provider webhook hits Payments Webhook endpoint.
6. Event/Audit Domain stores event idempotently in `payment_webhook_events`.
7. Orders Domain updates payment status (`pending/succeeded/canceled/failed/refunded`) and operational availability.

Key rule: redirect page is UX-only; webhook is source of truth.

### 3) B2B SaaS Billing (platform subscription)

1. Owner selects plan in dashboard.
2. Billing Domain creates payment in platform merchant contour.
3. Billing webhook updates `billing_subscriptions` and `billing_payments`.
4. RBAC/Feature gates evaluate subscription state:
   - `active`: full access,
   - `past_due`: staged restrictions (warning -> limited),
   - `canceled`: read-only/suspended policy.

Key rule: B2B flow is isolated from restaurant customer payments.

### 4) Admin Roles and Operational Control

1. Dashboard user authenticates.
2. Admin/RBAC Domain resolves membership (`owner` / `manager` + permissions).
3. All mutations (menu publish, branch settings, payment config, billing actions) pass permission guard.
4. Critical actions are written to audit trail (actor, target, before/after, timestamp).

## Patterns to Follow

### Pattern 1: Mandatory Context Envelope
**What:** Every protected server handler receives validated `{ shop_id, city_id?, restaurant_scope?, actor }`.
**When:** All dashboard mutations, checkout creation, order status updates.
**Example:**
```typescript
const tenant = event.context.tenant
if (!tenant?.shop?.id) throw createError({ statusCode: 401, statusMessage: 'Tenant required' })
const actor = await requireDashboardAccess(event, ['owner', 'manager'])
```

### Pattern 2: Webhook-First State Transitions
**What:** Persist outbound intent + inbound webhook; webhook drives final status.
**When:** B2C payments and B2B billing.
**Example:**
```typescript
await savePaymentIntent(intent)
// redirect for UX only
// later in webhook:
await saveWebhookEventOnce(provider, eventId, payload)
await applyPaymentStatusTransition(orderId, mappedStatus)
```

### Pattern 3: Menu Inheritance with Branch Overrides
**What:** Base catalog at `shop` + sparse `restaurant` overrides (`price_override`, `is_hidden`, stop-list).
**When:** Branch-specific storefront customization without data duplication.

### Pattern 4: Additive Migration Strategy
**What:** `nullable -> backfill -> index -> not null`, keep temporary fallback paths.
**When:** Brownfield schema changes for billing, publishing, branch payment overrides.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Payment Status from Return URL
**What:** Marking orders as paid on client return/success page.
**Why bad:** Lost tabs/network drops create false positives and reconciliation drift.
**Instead:** webhook-confirmed transition only.

### Anti-Pattern 2: Cross-Domain Handler Sprawl
**What:** One endpoint handling tenant resolution, menu logic, payment adapter details, and admin policy at once.
**Why bad:** Hard to scale and test; brittle for future provider/role changes.
**Instead:** thin route handlers calling domain services/adapters.

### Anti-Pattern 3: Unversioned Menu Publication
**What:** Editing live menu rows directly with no publish boundary.
**Why bad:** Guest sees inconsistent state mid-edit.
**Instead:** draft + publish snapshot per branch/tenant.

## Scalability Considerations

| Concern | At 100 branches | At 10K branches | At 1M monthly orders |
|---------|-----------------|-----------------|----------------------|
| Tenant isolation | Middleware + indexed `shop_id` queries | Strict RLS + policy testing + query guard rails | Same + periodic policy audit automation |
| Menu reads | Direct query + branch override join | Published snapshot/materialized read model | Cached snapshots + invalidation on publish |
| Payment webhooks | Single endpoint + idempotent insert | Retry-safe workers + dead-letter review | Queue-backed processing + replay tooling |
| Order operations | Direct dashboard polling | Filtered streams per branch | Event-driven fanout for status channels |
| RBAC checks | In-request membership lookup | Permission cache with short TTL | Precomputed permission scopes + audit sampling |

## Suggested Build Order (Roadmap Implications)

1. **Access and Context Hardening**
   - Normalize request context envelope for all protected APIs.
   - Finalize Owner/Manager permission matrix with branch scope.
2. **Menu Publishing Backbone**
   - Introduce draft/publish model and branch override read path.
   - Make storefront consume published view only.
3. **Branch QR Storefront Consistency**
   - Standardize branch QR deep-link contract and checkout preselection.
   - Validate branch-to-tenant ownership server-side on each step.
4. **Payment Domain Stabilization (B2C)**
   - Keep webhook-first; add stronger replay protection and operational retries.
   - Prepare provider adapter seam for YooKassa/T-Bank parity.
5. **Billing Domain (B2B)**
   - Implement subscription tables/endpoints/webhooks isolated from B2C.
   - Add graceful access degradation tied to subscription lifecycle.
6. **Observability and Audit**
   - Add structured audit events for pricing/menu/role/payment changes.
   - Add admin diagnostics for stuck webhooks and payment reconciliation.

Dependency rationale:
- Publishing before large QR rollout avoids inconsistent guest menu.
- B2C payment hardening before B2B billing reuses webhook/event architecture.
- RBAC hardening early reduces security debt across all subsequent phases.

## Sources

- Internal project context and scope:
  - `.planning/PROJECT.md`
  - `.planning/codebase/ARCHITECTURE.md`
  - `.planning/codebase/STRUCTURE.md`
- Domain contracts:
  - `docs/TERMS.md`
  - `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`
  - `docs/SAAS_BILLING_RU.md`
  - `docs/MULTI_TENANT_SAAS.md`
