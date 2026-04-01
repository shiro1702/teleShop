# Phase 1: tenant-foundation-and-access-governance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 01-tenant-foundation-and-access-governance
**Areas discussed:** Tenant/Branch data model, RBAC policy depth, Access enforcement strategy

---

## Tenant/Branch data model

| Option | Description | Selected |
|--------|-------------|----------|
| `platform -> tenant -> branch` | Separate tenant layer independent from restaurant naming | |
| `platform -> restaurant -> branch` | Tenant boundary equals restaurant entity (simpler v1) | ✓ |
| Hybrid model | `tenant` as legal entity plus `restaurant` brand layer | |

**User's choice:** `platform -> restaurant -> branch`
**Notes:** User explicitly chose to avoid an extra tenant layer in Phase 1.

---

## RBAC policy depth

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline roles | `Owner/Manager` + fixed deny rules in v1 | ✓ |
| Action-level matrix now | Full granular permissions table in Phase 1 | |
| Hybrid scaffold | Baseline now + latent permission scaffold | |

**User's choice:** Baseline roles for Phase 1.
**Notes:** Keep implementation practical for current milestone; no full policy editor yet.

---

## Access enforcement strategy

| Option | Description | Selected |
|--------|-------------|----------|
| App-layer checks only | Middleware/service checks without DB-enforced RLS baseline | |
| Defense-in-depth | `DB RLS + server checks` | ✓ |
| DB-only | RLS-only with minimal server-side guarding | |

**User's choice:** Defense-in-depth (`DB RLS + server checks`).
**Notes:** Security correctness prioritized over minimal implementation effort.

---

## Claude's Discretion

- Exact technical implementation details for RLS policy naming and helper function decomposition.

## Deferred Ideas

None.
