# Roadmap: teleShop

## Overview

This roadmap delivers teleShop v1 as a branch-first QR ordering platform for quick-service restaurants: first secure tenant and governance boundaries, then a correct branch storefront and menu publication flow, followed by reliable webhook-based payments, branch order operations, and platform-level oversight with auditability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Tenant Foundation and Access Governance** - Establish tenant/branch ownership model and enforce role/isolation controls.
- [ ] **Phase 2: Branch Storefront and QR Publishing** - Deliver branch QR entry, branding isolation, and published menu correctness.
- [ ] **Phase 3: Guest Checkout and Payment Reliability** - Deliver fast guest checkout and webhook-authoritative payment lifecycle.
- [ ] **Phase 4: Branch Fulfillment Operations** - Deliver paid-order execution loop and branch pickup acceptance controls.
- [ ] **Phase 5: Platform Oversight and Auditability** - Deliver aggregator-level operational visibility and immutable critical-action audit trail.

## Phase Details

### Phase 1: Tenant Foundation and Access Governance
**Goal**: Restaurant owners and platform admins can safely manage tenants, branches, and role permissions with strict tenant isolation.
**Depends on**: Nothing (first phase)
**Requirements**: TENA-01, TENA-02, TENA-03, TENA-04, ADMN-02
**Success Criteria** (what must be TRUE):
  1. Owner can create and manage a tenant workspace and branch records from dashboard flows.
  2. Owner can assign Owner/Manager roles and users only see actions/data allowed by role.
  3. Protected API operations are blocked when tenant or branch context does not match actor scope.
  4. Aggregator admin can enforce governance policies for role and access management across tenants.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Branch Storefront and QR Publishing
**Goal**: Guests consistently land on the correct branch storefront and see only branch-valid, published menu data.
**Depends on**: Phase 1
**Requirements**: QRST-01, QRST-02, QRST-03, QRST-04
**Success Criteria** (what must be TRUE):
  1. Guest scanning a branch QR always opens the intended branch storefront context.
  2. Branch branding updates (name/logo/theme) appear on that branch storefront without affecting other branches.
  3. Staff can publish menu changes and storefront reflects only the currently published catalog.
  4. Disabled or out-of-stock items are visibly unavailable and cannot be ordered.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Guest Checkout and Payment Reliability
**Goal**: Guests can place and pay branch orders quickly while payment truth is finalized by secure webhook reconciliation.
**Depends on**: Phase 2
**Requirements**: PAYM-01, PAYM-02, PAYM-03, PAYM-04, PAYM-05
**Success Criteria** (what must be TRUE):
  1. Guest can submit an order without creating an account.
  2. Guest can complete online payment through configured provider flow.
  3. Order payment status reaches terminal state only from verified provider webhook events with idempotent handling.
  4. Dashboard shows a clear per-order payment timeline (pending, paid, failed, refunded when applicable).
  5. Owner can securely configure and rotate payment credentials in dashboard settings.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Branch Fulfillment Operations
**Goal**: Branch staff can process paid self-pickup orders through fulfillment statuses with clear acceptance controls.
**Depends on**: Phase 3
**Requirements**: ORDR-01, ORDR-02, ORDR-03, ORDR-04
**Success Criteria** (what must be TRUE):
  1. Staff dashboard highlights new paid orders in a queue suitable for preparation priority.
  2. Staff can move orders through fulfillment states from new to completion or cancellation.
  3. Fulfillment status updates remain independent from payment provider status fields.
  4. Branch pickup availability and operating hours settings immediately control whether new orders are accepted.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Platform Oversight and Auditability
**Goal**: Aggregator admins can monitor platform operations and review immutable records of critical control actions.
**Depends on**: Phase 4
**Requirements**: ADMN-01, ADMN-03
**Success Criteria** (what must be TRUE):
  1. Aggregator admin can view tenants and branches with actionable operational health visibility.
  2. Critical actions (payment config changes, role changes, status overrides) are recorded in an auditable timeline.
  3. Admin can inspect who changed what and when for cross-tenant compliance and incident review.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tenant Foundation and Access Governance | 0/TBD | Not started | - |
| 2. Branch Storefront and QR Publishing | 0/TBD | Not started | - |
| 3. Guest Checkout and Payment Reliability | 0/TBD | Not started | - |
| 4. Branch Fulfillment Operations | 0/TBD | Not started | - |
| 5. Platform Oversight and Auditability | 0/TBD | Not started | - |
