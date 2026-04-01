# teleShop - QR SaaS for quick-service restaurants

## What This Is

teleShop is a multi-tenant SaaS product for quick-service restaurants: kiosks, food trucks, and coffee shops. Each restaurant branch gets its own QR storefront with independent branding and settings so guests can place and pay for orders without installing an app. The platform target is B2B self-service for owners with centralized aggregator administration.

## Core Value

A guest scans a branch QR and completes an order with online payment in under 60 seconds, while the venue reduces cashier load and queue pressure at peak hours.

## Requirements

### Validated

- ✓ Multi-tenant storefront routing and tenant context resolution — existing
- ✓ Basic online order flow with payment intent and webhook reconciliation (YooKassa in runtime code) — existing
- ✓ Dashboard access control and role-gated areas — existing

### Active

- [ ] Branch-level QR storefront customization (brand/theme/domain or subdomain) for v1 operator experience
- [ ] Reliable online payments for branch orders with clear status lifecycle and operational visibility in admin
- [ ] Aggregator and restaurant admin workflows for menu publication and order status handling
- [ ] Fast self-service checkout optimized for quick-service venues (kiosk/food truck/coffee shop)

### Out of Scope

- Restaurant-level promo codes and campaign mechanics in v1 — deferred to later milestone
- Delivery (zones, tariffs, SLA) in v1 — v1 is self-pickup only
- Native mobile apps in v1 — web + QR flow is sufficient for first release

## Context

- Current codebase is a Nuxt + Supabase brownfield with existing multi-tenant and order/payment primitives.
- Product direction is narrowing to B2B self-service for quick-service restaurants with branch QR ordering.
- Existing implementation already documents and partially implements payment architecture (provider webhook as source of truth).
- Phase planning must prioritize speed of order placement, branch customization, and operational admin visibility.

## Constraints

- **Fulfillment model**: Self-pickup only in v1 — keeps logistics out of first release.
- **Payments**: Online payment only in v1 (YooKassa/T-Bank direction) — no cash/COD path in first milestone.
- **Tenant model**: Branch-specific QR experience and isolation — each branch needs independent visual and operational settings.
- **Platform scope**: B2B self-service first — features for end-user loyalty/gamification are secondary.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus v1 on kiosks/food trucks/coffee shops | Fast-service environments suffer most from queue and cashier bottlenecks | — Pending |
| Self-pickup only for v1 | Reduces operational complexity and accelerates time to value | — Pending |
| Online payment only for v1 | Streamlined guest flow and simpler accounting pipeline | — Pending |
| Defer promo codes | Not critical for initial NVP flow | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after initialization*
