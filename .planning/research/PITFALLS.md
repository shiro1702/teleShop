# Domain Pitfalls

**Domain:** B2B QR-order SaaS for quick-service restaurants (brownfield evolution)
**Researched:** 2026-04-01

## Critical Pitfalls

Mistakes that usually cause payment incidents, tenant trust loss, or expensive rewrites.

### Pitfall 1: Webhook-first is declared, but runtime is return-page-first
**What goes wrong:** Order/payment state is updated from checkout redirect or optimistic UI before verified provider webhook is processed.
**Why it happens:** Teams optimize UX speed and treat redirect success as financial truth.
**Consequences:** False "paid" orders, kitchen starts unpaid orders, reconciliation disputes, support load spikes.
**Warning signs:**
- `paid` orders appear without confirmed webhook event row.
- Order state changes happen in frontend flow even when webhook endpoint is unavailable.
- Reconciliation report has "payment in provider, not in DB" or inverse cases.
**Prevention:** Make webhook event the only source of truth for terminal payment states; keep redirect page informational; enforce idempotent event log with unique `provider + event_id`; explicitly store verification result before mutating `orders`.
**Phase should address it:** **Phase 1 - Payment reliability foundation** (contract hardening, idempotency, status mapping, webhook-first invariant tests).

### Pitfall 2: Missing cryptographic verification and replay protection
**What goes wrong:** Webhook endpoint accepts structurally valid payloads and mutates business state without robust authenticity checks.
**Why it happens:** Teams assume endpoint obscurity/IP checks are enough, or postpone signature handling.
**Consequences:** Forged payment events, replayed events, fraudulent status flips, security incidents.
**Warning signs:**
- Webhook handler processes events with `is_verified` absent/always true.
- No timestamp window checks and no replay detection beyond duplicate DB inserts.
- Security review cannot prove timing-safe signature comparison path.
**Prevention:** Validate webhook authenticity before any state mutation (provider-specific signature/secret, raw body validation, timing-safe compare, timestamp tolerance, replay guard); reject unverified events with explicit audit trail.
**Phase should address it:** **Phase 1 - Payment reliability foundation** (security gate before business logic).

### Pitfall 3: Tenant isolation leaks through branding/domain edge-cases
**What goes wrong:** Branch branding and custom domain logic resolve wrong tenant context (host/path fallback collision, stale mapping, missing scope checks).
**Why it happens:** Routing and branding evolve faster than tenant directory and authorization model.
**Consequences:** Cross-tenant data exposure, incorrect storefront theme/menu, high-severity trust incident.
**Warning signs:**
- Wrong logo/theme/menu appears under a tenant domain after deploy.
- Admin APIs rely on frontend-selected `shop_id` or `restaurant_id` without server re-validation.
- Incident reports mention "saw another branch data for a moment."
**Prevention:** Use canonical tenant resolution precedence (`custom_domain` -> `subdomain/path` -> explicit fallback), enforce server-side scope checks on every write/read, keep tenant-domain mapping table with uniqueness constraints and rollout-safe migration path.
**Phase should address it:** **Phase 2 - Branch branding and tenant boundaries** (routing contract + isolation tests + migration strategy).

### Pitfall 4: B2B and B2C payment contours drift or mix
**What goes wrong:** Subscription billing and customer order payments share assumptions, keys, or status semantics.
**Why it happens:** Reuse pressure in brownfield code and partial provider abstractions.
**Consequences:** Accounting confusion, incorrect entitlement state, impossible audits, legal/ops risk.
**Warning signs:**
- Shared tables/handlers with ambiguous `payment_type` behavior.
- Platform and restaurant merchant credentials managed in same runtime path without strict separation.
- Billing support cannot explain source for a specific charge without code inspection.
**Prevention:** Keep separate APIs/events/data models for B2B and B2C; document and enforce boundary in code contracts; separate credentials, webhooks, and audit logs per contour.
**Phase should address it:** **Phase 3 - Billing and entitlement hardening** (explicit separation + operator tooling).

## Moderate Pitfalls

### Pitfall 1: Payment provider abstraction exists in docs only
**What goes wrong:** Product plans for YooKassa + T-Bank, but runtime is tightly coupled to one provider.
**Prevention:** Introduce provider strategy interface (`createPayment`, `verifyWebhook`, `mapStatus`) before second provider rollout; build contract tests with shared fixtures.
**Warning signs:**
- Provider name appears in route names, domain logic, and DB statuses without adapter layer.
- New provider estimate keeps growing due to "many hidden coupling points."
**Phase should address it:** **Phase 1.5 / 2 - Multi-provider readiness**.

### Pitfall 2: Admin operations are mutable but non-auditable
**What goes wrong:** Critical admin actions (plan changes, integration keys, branch payment settings, manual grace overrides) are not immutable in audit trail.
**Prevention:** Add append-only operational audit log with actor, scope, before/after snapshot, reason, and correlation id; expose filtered timeline in admin UI.
**Warning signs:**
- Support asks "who changed this?" and team cannot answer from system logs alone.
- Security/compliance checks rely on database diffing or manual recollection.
**Phase should address it:** **Phase 3 - Admin operations and governance**.

### Pitfall 3: Brownfield migration without compatibility envelope
**What goes wrong:** New tenant/payment/billing schema goes live without staged migration (`nullable -> backfill -> enforce`) and compatibility flags.
**Prevention:** Use phased DB migration pattern, shadow writes, and cutover checklist; keep implemented-vs-planned matrix in docs to prevent roadmap fiction.
**Warning signs:**
- Emergency patches to restore old fields after migration.
- Runtime branches on "if new field exists" scattered across code.
**Phase should address it:** **Phase 0 - Migration safety rails** (before feature expansion).

## Minor Pitfalls

### Pitfall 1: Terminology drift between dashboard and storefront
**What goes wrong:** Internal/admin and public terms for branch/restaurant are mixed in UI and docs.
**Prevention:** Enforce glossary-based copy linting in UX review checklist and acceptance criteria.
**Warning signs:**
- Same entity labeled differently in a single user flow.
- Support scripts and UI labels mismatch.
**Phase should address it:** **Phase 2 - Brand and UX consistency**.

### Pitfall 2: Missing operational SLOs for checkout/webhooks
**What goes wrong:** Reliability work is shipped without target latency/error budgets.
**Prevention:** Define and monitor SLOs (checkout create latency, webhook processing delay, success ratio by provider/branch); wire alerts to ops channel.
**Warning signs:**
- Incidents discovered by restaurant complaints first.
- No dashboard for payment funnel drops by branch/provider.
**Phase should address it:** **Phase 1 - Observability baseline**.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Payment reliability foundation | Webhook not authoritative in final status | Enforce webhook-first state machine + invariant tests on status transitions |
| Payment reliability foundation | Forged/replayed webhook events | Signature/secret verification, timestamp tolerance, replay guard, audit of rejected events |
| Branch-level branding and routing | Tenant/domain mis-resolution leaks data | Canonical tenant routing contract + uniqueness constraints + end-to-end host/path tests |
| Branch-level branding and routing | Branding rollout breaks fallback paths | Feature-flagged rollout, default safe theme, domain ownership verification before activation |
| Admin operations | No immutable audit for critical actions | Append-only audit log + actor/scope/reason + searchable admin timeline |
| Billing + entitlements | B2B/B2C contours coupled | Separate APIs/tables/webhooks/credentials and explicit boundary checks |
| Brownfield migrations | Breaking schema cutovers | Nullable-backfill-enforce migration steps + cutover checklist + rollback plan |

## Sources

- Internal project context (`.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `docs/TERMS.md`, `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/MULTI_TENANT_SAAS.md`) — **HIGH**.
- Stripe official webhook signature guidance: [https://stripe.com/docs/webhooks/signatures](https://stripe.com/docs/webhooks/signatures) — **HIGH**.
- AWS tenant routing strategies (updated 2025-05-07): [https://aws.amazon.com/blogs/networking-and-content-delivery/tenant-routing-strategies-for-saas-applications-on-aws/](https://aws.amazon.com/blogs/networking-and-content-delivery/tenant-routing-strategies-for-saas-applications-on-aws/) — **MEDIUM-HIGH**.
- YooKassa developer docs (payment/webhook ecosystem pages): [https://yookassa.ru/developers/using-api/webhooks](https://yookassa.ru/developers/using-api/webhooks), [https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/save-payment-method/save-during-payment](https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/save-payment-method/save-during-payment) — **MEDIUM** (webhook page intermittently unavailable during fetch).
- General webhook reliability/security ecosystem writeups (idempotency, replay prevention) used only as supporting signals — **LOW** unless cross-verified by official docs.
