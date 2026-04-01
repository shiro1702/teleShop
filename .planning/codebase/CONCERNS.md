# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**B2B billing documented but not implemented:**
- Issue: B2B subscription flows are specified in docs, but there are no matching API routes or DB runtime handling for subscription lifecycle.
- Files: `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`
- Impact: Product commitments (`trial`, `active`, `past_due`, `grace`, `canceled`) cannot be enforced in code; billing policy remains manual.
- Fix approach: Implement `server/api/billing/checkout.post.ts`, `server/api/webhooks/billing/[provider].post.ts`, `server/api/billing/subscription.get.ts` and add `billing_subscriptions`/`billing_payments` schema migrations aligned with `docs/SAAS_BILLING_RU.md`.

**Payment provider architecture mismatch (single-provider runtime):**
- Issue: Docs define YooKassa + T-Bank with provider abstraction, but runtime payment creation/webhook handling is YooKassa-only.
- Files: `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `server/utils/yookassa.ts`, `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`
- Impact: Scaling to second provider requires endpoint and schema branching later; increases integration risk and migration overhead.
- Fix approach: Add provider strategy layer (`provider -> createPayment/verifyWebhook`) and provider-specific webhooks under unified contract before launching T-Bank.

## Known Bugs

**Webhook authenticity is not verified before state mutation:**
- Symptoms: Webhook handler accepts payload, updates `orders.payment_status`, and marks event processed without cryptographic signature verification.
- Files: `server/api/webhooks/yookassa.post.ts`
- Trigger: Any request with `object.id` and event fields can reach processing path.
- Workaround: Restrict endpoint exposure at infra layer temporarily; add signature check and reject unverified events before DB updates.

**Dashboard integrations page uses mock secret-like values in client code:**
- Symptoms: UI state initializes with token-like strings and local-only toggles that do not call secure backend for payment integrations.
- Files: `pages/dashboard/integrations.vue`
- Trigger: Opening `/dashboard/integrations`.
- Workaround: Replace mock state with server-fetched masked values and owner-only API mutations.

## Security Considerations

**Payment webhook replay/forgery risk:**
- Risk: Signature header is read but not validated; idempotency covers duplicates, not forged first-delivery events.
- Files: `server/api/webhooks/yookassa.post.ts`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`
- Current mitigation: Unique constraint on `payment_webhook_events(provider, event_id)` and duplicate short-circuit.
- Recommendations: Verify provider signature/secret, validate event timestamp window, persist explicit `is_verified`, reject unverified events before `orders` update.

**Secrets stored directly in tenant data model:**
- Risk: Provider secrets are persisted in `shops` and loaded in tenant utilities; accidental exposure path grows with broader usage.
- Files: `supabase/migrations/018_payments_and_requisites.sql`, `server/utils/tenant.ts`, `server/api/checkout/create.post.ts`
- Current mitigation: Server-side access via service role only.
- Recommendations: Move to encrypted-at-rest secrets store or encrypted columns with key management; return masked-only values to UI.

## Performance Bottlenecks

**Synchronous payment and DB writes on checkout critical path:**
- Problem: Checkout blocks on external provider call then writes intent and order update sequentially.
- Files: `server/api/checkout/create.post.ts`, `server/utils/yookassa.ts`
- Cause: No queue/outbox pattern; user-facing latency directly tied to provider response.
- Improvement path: Add timeout/circuit-breaker policy, structured retries for transient errors, and observable metrics around provider round-trip.

## Fragile Areas

**Docs-to-code divergence in payment contracts:**
- Files: `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/SAAS_BILLING_RU.md`, `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`
- Why fragile: Documentation defines broader architecture and statuses than implemented runtime, creating false confidence for product/ops decisions.
- Safe modification: Treat docs as target state; introduce explicit "implemented vs planned" matrix in docs and gate feature flags by implemented endpoints only.
- Test coverage: No automated tests detected for payment routes, webhook flows, or billing state transitions.

## Scaling Limits

**Shop-level credentials only for B2C acquiring:**
- Current capacity: One payment credential set per `shop` via `shops.yookassa_shop_id`/`shops.yookassa_secret_key`.
- Limit: Multi-branch organizations with different merchant contracts cannot be represented without manual workaround.
- Scaling path: Add `restaurant_payment_providers` + fallback resolution (`restaurant` -> `shop`) as outlined in `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`.

## Dependencies at Risk

**Provider integration is hard-coupled to YooKassa API contract:**
- Risk: Failure/changes at single provider endpoint directly affect online payment creation.
- Impact: `POST /api/checkout/create` loses online payment capability when provider API behavior changes or degrades.
- Migration plan: Introduce provider adapter interface and support failover/provider switch at configuration level.

## Missing Critical Features

**SaaS subscription enforcement loop missing:**
- Problem: No executable logic for plan billing, renewal failure handling, grace policy, or downgrade scheduling.
- Blocks: Monetization controls and automated entitlement management promised in `docs/SAAS_BILLING_RU.md`.

**Billing audit and operator tooling incomplete:**
- Problem: Docs require billing event/audit traceability for plan changes and grace overrides; no B2B audit model/API implemented.
- Blocks: Compliance-friendly operations and support workflows for disputed billing events.

## Test Coverage Gaps

**Payments and webhooks untested by automated suite:**
- What's not tested: checkout intent creation, webhook idempotency, status mapping (`pending/succeeded/canceled/failed/refunded`), and replay handling.
- Files: `server/api/checkout/create.post.ts`, `server/api/webhooks/yookassa.post.ts`, `supabase/migrations/018_payments_and_requisites.sql`
- Risk: Regression in payment state transitions and security checks can ship unnoticed.
- Priority: High

**Billing (B2B) lifecycle lacks executable tests and implementation:**
- What's not tested: subscription creation, renewal, `past_due`, grace, cancellation, plan upgrade/downgrade semantics.
- Files: `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`
- Risk: Product behavior cannot be validated against documented commitments.
- Priority: High

---

*Concerns audit: 2026-04-01*
