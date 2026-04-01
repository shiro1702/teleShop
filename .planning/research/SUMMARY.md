# Project Research Summary

**Project:** teleShop
**Domain:** B2B multi-tenant QR ordering SaaS for quick-service restaurant branches
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

teleShop should be built as a focused B2B self-service platform for quick-service branches where the core promise is simple: scan QR, order, pay online, pick up fast. Expert implementations in this domain prioritize branch-scoped context continuity, low-friction guest checkout, and strict operational reliability over broad feature breadth. Given the existing brownfield codebase, the most effective strategy is to evolve the current Nuxt + Supabase monolith into clearer domain boundaries rather than replatforming.

Recommended execution is webhook-first payments, published-menu discipline, and role-gated branch operations. This matches the product constraints in `PROJECT.md`: self-pickup only, online-pay only, and branch-specific QR storefronts. For v1, platform quality depends less on visual complexity and more on correctness in tenant scope, payment reconciliation, and order-state transitions during rush-hour operations.

Main risks are payment truth drift (return-page-first behavior), webhook security gaps (verification/replay), and tenant leakage through routing/domain edge cases. Mitigation is explicit: enforce webhook-authoritative state transitions, cryptographic verification + idempotent event logs, and mandatory server-side tenant/branch context checks on every protected read/write.

## Key Findings

### Recommended Stack

The stack baseline is strong and should remain incremental: Nuxt 4.4.x + Vue 3.5 + TypeScript 5.6, Supabase Postgres/Auth with strict RLS, and payment-provider adapters with YooKassa first and T-Bank ready. This preserves delivery speed and avoids rewrite risk while aligning with operational requirements for multi-tenant branch isolation and payment auditability.

For reliability at scale, add Redis-backed async processing (BullMQ) for retries/event workflows and enforce observability with structured logging and traces.

**Core technologies:**
- Nuxt 4.4.x + Nitro: single deployable for storefront, dashboard, and APIs - fastest brownfield path with shared tenant context.
- Supabase Postgres + Auth + RLS: system of record for tenant-safe data, memberships, and auditable state.
- YooKassa (primary) with T-Bank adapter seam: local market fit with fallback-ready provider abstraction.
- TypeScript + Zod: typed contracts and runtime validation on API/webhook boundaries.
- Redis + BullMQ + Pino/OpenTelemetry: resilient async processing and incident-grade observability.

### Expected Features

v1 must concentrate on operational table stakes for QSR: branch QR context, rapid guest checkout, reliable online payment reconciliation, and dashboard control loops for menu and order execution. Differentiators should strengthen monetization and rollout speed, but only after core reliability is stable.

**Must have (table stakes):**
- Branch-scoped QR storefront with stable tenant/city/branch context from scan through checkout.
- Guest-first mobile checkout optimized for sub-60-second order initiation.
- Online payment flow with webhook-first reconciliation and idempotent handling.
- Real-time menu availability/price correctness with branch overrides and stop-list support.
- Order lifecycle management in dashboard plus Owner/Manager role-gated controls.
- Branch operations settings (hours, pickup availability, branding) and basic operational notifications.

**Should have (competitive):**
- Branch-level theming/domain policy by plan tier for clear B2B upsell.
- Built-in QR kit management per branch (general + cashier first).
- Lightweight branch analytics (scan-to-paid conversion, paid order trends, prep-time proxy).
- Branch onboarding templates (clone menu/settings) for multi-branch expansion speed.

**Defer (v2+):**
- Delivery logistics and courier routing complexity.
- Heavy loyalty/promo engines and campaign automation.
- Mandatory account creation before checkout.
- Deep bidirectional POS/ERP integration breadth.
- Multi-country tax/multi-currency complexity.

### Architecture Approach

Architecture should remain one Nuxt runtime with modular server domains: tenant resolution, storefront/catalog publishing, checkout/payments, orders operations, RBAC/admin, B2B billing, provider adapters, and event/audit services. Enforce a mandatory context envelope (`shop`, optional branch scope, actor), keep webhook-first state transitions for both B2C and B2B contours, and isolate B2B billing from customer order payments at API, credential, webhook, and data-model levels.

**Major components:**
1. Tenant and storefront routing layer - resolves host/path/QR into validated tenant + branch context.
2. Menu publishing + branch overrides domain - separates draft editing from published storefront reads.
3. Checkout/payments + provider adapter layer - creates intents, verifies webhooks, maps canonical statuses.
4. Orders operations domain - executes order lifecycle independent from payment provider-specific states.
5. RBAC/admin + audit domain - enforces owner/manager permissions and immutable critical-action history.
6. Billing domain - handles subscription lifecycle and entitlements isolated from B2C ordering.

### Critical Pitfalls

1. **Payment truth drift to return URL** - enforce webhook-only terminal state transitions with invariant tests.
2. **Weak webhook verification/replay defense** - verify signatures on raw body, add timestamp tolerance and replay guards before mutation.
3. **Tenant/branch isolation leaks in routing/branding** - canonical resolution precedence and strict server-side scope validation.
4. **B2B/B2C payment contour coupling** - separate credentials, handlers, tables, and status semantics by contour.
5. **Unsafe brownfield cutovers** - use nullable -> backfill -> enforce migrations with compatibility windows and rollback plans.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation Hardening (Context, RBAC, Migration Safety)
**Rationale:** Security and tenancy boundaries are prerequisites for every later feature and prevent compounding risk.
**Delivers:** Mandatory context envelope across protected APIs, finalized Owner/Manager permission matrix, migration safety rails and compatibility checklist.
**Addresses:** Role-based dashboard access, secure branch operations.
**Avoids:** Tenant leakage and brownfield breakage pitfalls.

### Phase 2: Menu Publishing and Branch QR Consistency
**Rationale:** Storefront correctness must be stabilized before scaling checkout volume.
**Delivers:** Draft/publish menu model, published-only storefront reads, branch override path, standardized QR deep-link contract.
**Uses:** Nuxt/Nitro server domains + Supabase relational model with constrained branch ownership checks.
**Implements:** Branch storefront + menu publishing architecture boundary.

### Phase 3: Payment Reliability Core (B2C)
**Rationale:** Revenue-critical reliability must be production-grade before adding monetization breadth.
**Delivers:** Webhook-authoritative payment state machine, signature verification, replay/idempotency controls, provider adapter normalization, reconciliation visibility.
**Addresses:** Online-pay-only requirement, fast guest checkout trust.
**Avoids:** False paid orders, fraud/replay, status drift incidents.

### Phase 4: Order Ops Loop and v1 Admin Control
**Rationale:** Once payment truth is stable, branch teams need fast operational execution.
**Delivers:** Dashboard order lifecycle controls, stop-list/availability responsiveness, branch settings and baseline notifications.
**Addresses:** QSR rush-hour execution and self-pickup flow completion.
**Avoids:** Operational blind spots and missed paid orders.

### Phase 5: B2B Billing, Entitlements, and Commercial Differentiators
**Rationale:** Commercialization should build on a stable operations core.
**Delivers:** Subscription lifecycle (`trial/active/past_due/canceled`), feature gating, branch theming/domain policy by plan, initial analytics and onboarding templates.
**Addresses:** B2B monetization and expansion workflows.
**Avoids:** B2B/B2C contour mixing and entitlement ambiguity.

### Phase Ordering Rationale

- Dependencies run from secure context -> published menu consistency -> payment truth -> branch operations -> monetization.
- Grouping aligns with architecture boundaries, minimizing cross-domain handler sprawl.
- This ordering front-loads highest-severity pitfalls (payment/tenant/security) before feature surface expansion.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Payment Reliability Core):** provider-specific signature nuances, webhook retry semantics, and canonical status mapping edge cases.
- **Phase 5 (Billing + Entitlements):** legal/accounting contour separation details and grace/restriction policy tuning.
- **Phase 2 (Branch domains/theming rollout):** custom-domain ownership verification and safe migration sequencing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Context/RBAC hardening):** established SaaS tenancy and permission patterns are well documented.
- **Phase 4 (Order ops + notifications baseline):** common event-driven dashboard patterns with low novelty.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong alignment with existing codebase and official ecosystem guidance; low replatform uncertainty. |
| Features | MEDIUM-HIGH | Table stakes are clear across multiple industry sources; differentiator prioritization still product-strategy sensitive. |
| Architecture | HIGH | Consistent with brownfield constraints and current system primitives; clear domain boundaries identified. |
| Pitfalls | HIGH | Critical risks are repeatedly validated in payment and multi-tenant SaaS practice; mitigation patterns are concrete. |

**Overall confidence:** HIGH

### Gaps to Address

- **Provider parity depth (YooKassa vs T-Bank):** validate feature parity and edge-case mapping before branch-level override rollout.
- **Operational SLO targets:** define exact latency/error budgets for checkout creation and webhook processing during planning.
- **Custom-domain rollout mechanics:** finalize ownership verification and fallback behavior for branding/domain activation.
- **Analytics scope boundaries:** lock v1 metric definitions to prevent accidental expansion into BI-heavy implementation.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` - product constraints and v1 boundaries.
- `.planning/research/STACK.md` - stack baseline, versions, and prescriptive decisions.
- `.planning/research/ARCHITECTURE.md` - domain boundaries, data flows, and ordering implications.
- `.planning/research/PITFALLS.md` - critical risk register and mitigation strategy.
- Supabase production guidance: https://supabase.com/docs/guides/deployment/going-into-prod
- Nuxt release stream: https://github.com/nuxt/nuxt/releases/tag/v4.4.0

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` - table stakes/differentiators synthesized from official/vendor landscape.
- YooKassa webhook docs: https://yookassa.ru/developers/using-api/webhooks
- AWS tenant routing strategies: https://aws.amazon.com/blogs/networking-and-content-delivery/tenant-routing-strategies-for-saas-applications-on-aws/

### Tertiary (LOW confidence)
- Vendor/community QR-ordering pitfalls and market framing references cited in `FEATURES.md` and `PITFALLS.md` for directional validation only.

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
