# Requirements: teleShop

**Defined:** 2026-04-01
**Core Value:** A guest scans a branch QR and completes an order with online payment in under 60 seconds, while the venue reduces cashier load and queue pressure at peak hours.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Tenant and Access

- [ ] **TENA-01**: Owner can create and manage an isolated tenant workspace for their restaurant business.
- [ ] **TENA-02**: Owner can create and manage branch entities (filials) with independent operational settings.
- [ ] **TENA-03**: Owner can assign dashboard roles (Owner/Manager) with permission-based access to actions and data.
- [ ] **TENA-04**: System enforces tenant and branch isolation on every protected API read/write operation.

### Storefront and QR

- [ ] **QRST-01**: Guest can open the correct branch storefront by scanning a branch QR code.
- [ ] **QRST-02**: Branch storefront supports configurable branding (name, logo, primary colors/theme) without affecting other branches.
- [ ] **QRST-03**: Branch can publish menu updates so storefront shows only current published catalog state.
- [ ] **QRST-04**: Storefront displays only available menu items and blocks ordering for disabled/out-of-stock items.

### Checkout and Payments

- [ ] **PAYM-01**: Guest can place an order without mandatory account registration.
- [ ] **PAYM-02**: Guest can pay online for an order through configured payment providers.
- [ ] **PAYM-03**: Payment status is finalized from provider webhook events with idempotent processing.
- [ ] **PAYM-04**: Dashboard shows payment status timeline for each order (pending/paid/failed/refunded as applicable).
- [ ] **PAYM-05**: Owner can configure and update tenant payment credentials securely from dashboard settings.

### Order Operations

- [ ] **ORDR-01**: Branch staff can see new paid orders in dashboard with clear prioritization for preparation.
- [ ] **ORDR-02**: Staff can move orders through statuses (new -> in progress -> ready -> completed/canceled).
- [ ] **ORDR-03**: System keeps order fulfillment status independent from payment provider status fields.
- [ ] **ORDR-04**: Branch can configure pickup availability and operating hours that affect order acceptance.

### Admin and Platform

- [ ] **ADMN-01**: Aggregator admin can view tenants/branches and monitor operational health at platform level.
- [ ] **ADMN-02**: Aggregator admin can enforce role and access governance policies.
- [ ] **ADMN-03**: System records audit trail for critical admin actions (payment config, role changes, status overrides).

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Promotions

- **PROM-01**: Owner can create and manage branch-level promo codes and discount rules.
- **PROM-02**: Guest can apply promo code during checkout with eligibility validation.

### Delivery

- **DLVR-01**: Branch can configure delivery zones and tariff rules.
- **DLVR-02**: Guest can choose delivery and see ETA/cost before payment.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Delivery logistics in v1 | Product constraint: v1 focuses on self-pickup only for speed and simplicity |
| Promo/campaign engine in v1 | Explicitly deferred; not required to validate core QR-order value |
| Mandatory customer registration before checkout | Conflicts with sub-60-second quick-service ordering goal |
| Native mobile apps for v1 | Web + QR flow is sufficient for initial release and faster to ship |
| Full loyalty ecosystem (points/tier mechanics) | Not core to first milestone and increases implementation surface |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TENA-01 | Phase 1 | Pending |
| TENA-02 | Phase 1 | Pending |
| TENA-03 | Phase 1 | Pending |
| TENA-04 | Phase 1 | Pending |
| QRST-01 | Phase 2 | Pending |
| QRST-02 | Phase 2 | Pending |
| QRST-03 | Phase 2 | Pending |
| QRST-04 | Phase 2 | Pending |
| PAYM-01 | Phase 3 | Pending |
| PAYM-02 | Phase 3 | Pending |
| PAYM-03 | Phase 3 | Pending |
| PAYM-04 | Phase 3 | Pending |
| PAYM-05 | Phase 3 | Pending |
| ORDR-01 | Phase 4 | Pending |
| ORDR-02 | Phase 4 | Pending |
| ORDR-03 | Phase 4 | Pending |
| ORDR-04 | Phase 4 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 1 | Pending |
| ADMN-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap mapping*
