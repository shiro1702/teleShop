# Phase 1: tenant-foundation-and-access-governance - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish safe ownership and access governance for the platform core: restaurant/branch model, role assignment for Owner/Manager, and strict tenant-branch isolation in protected APIs and dashboard operations.

</domain>

<decisions>
## Implementation Decisions

### Tenant and Branch Model
- **D-01:** Canonical hierarchy for this project is `platform -> restaurant -> branch`.
- **D-02:** `restaurant` is the tenancy boundary (no extra standalone `tenant` layer in Phase 1).
- **D-03:** Branch entities are operational children of a restaurant and must never cross-link to another restaurant.

### RBAC Scope (Phase 1)
- **D-04:** Phase 1 uses baseline roles only: `Owner` and `Manager`.
- **D-05:** Permissions are enforced with a fixed allow/deny matrix for these two roles (no full action-level permission editor in Phase 1).
- **D-06:** Sensitive operations remain Owner-only in this phase (for example access-governance and credential-critical actions), while Manager handles day-to-day operations.

### Isolation and Enforcement Strategy
- **D-07:** Isolation truth model is defense-in-depth: `DB RLS + server checks`.
- **D-08:** Every protected API operation must validate restaurant/branch scope in server logic, even when RLS exists.
- **D-09:** Data access patterns must prefer scoped queries with explicit restaurant/branch filters to avoid accidental broad reads.

### Claude's Discretion
- Exact SQL policy shape and naming conventions for RLS policies.
- Internal helper function names and module breakdown for enforcement utilities.
- Error response wording, as long as it does not leak cross-tenant data.

</decisions>

<specifics>
## Specific Ideas

- Keep the model simple for v1: restaurant is the tenant boundary.
- Security priority is correctness over convenience; double checks at DB and server layers are expected.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Scope and Terms
- `.planning/PROJECT.md` - Product constraints, core value, and v1 boundaries.
- `.planning/REQUIREMENTS.md` - Requirement IDs mapped to this phase (TENA-01..04, ADMN-02).
- `.planning/ROADMAP.md` - Phase 1 goal, dependencies, and success criteria.
- `docs/TERMS.md` - Domain terminology that should remain consistent in implementation.

### Architecture and Multi-Tenant Constraints
- `.planning/research/ARCHITECTURE.md` - Recommended component boundaries and sequencing.
- `.planning/codebase/ARCHITECTURE.md` - Current runtime architecture and tenant/payment context.
- `.planning/codebase/STRUCTURE.md` - Canonical locations for API, middleware, and domain modules.
- `docs/MULTI_TENANT_SAAS.md` - Multi-tenant policy expectations and separation principles.

### Security and Access Context
- `.planning/codebase/CONVENTIONS.md` - Existing error-handling and server utility conventions.
- `middleware/dashboard-auth.global.ts` - Existing dashboard auth guard behavior to extend safely.
- `server/middleware/tenant.ts` - Current tenant context resolution entry point.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/middleware/tenant.ts`: existing request-context entry point for tenant/shop scoping.
- `middleware/dashboard-auth.global.ts`: current dashboard auth gate that can be extended for stricter role checks.
- `server/utils/tenant.ts`: utility area already aligned with tenant/shop assertions and can host scope helpers.

### Established Patterns
- API guards use fail-fast validation with explicit `createError(...)` responses.
- Tenant context is resolved early and then reused in handlers via shared server context.
- Direct route-level method files (`*.get.ts`, `*.post.ts`, `*.put.ts`) are preferred over large monolithic controllers.

### Integration Points
- Dashboard protected endpoints under `server/api/dashboard/**` are the primary RBAC enforcement surface.
- Tenant server middleware and utility helpers form the shared isolation boundary for storefront and dashboard APIs.
- Supabase migration flow in `supabase/migrations/` is the source of truth for RLS and schema-level governance.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-tenant-foundation-and-access-governance*
*Context gathered: 2026-04-01*
