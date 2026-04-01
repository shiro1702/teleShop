# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- Not detected in repository configuration.
- Config files not found: `vitest.config.*`, `jest.config.*`, `playwright.config.*`.

**Assertion Library:**
- Not detected (no dependency/scripts indicating `vitest`, `jest`, `chai`, or similar).

**Run Commands:**
```bash
npm run dev              # Primary development verification flow
npm run build            # Build-time validation
npm run preview          # Runtime smoke check of build output
```

## Test File Organization

**Location:**
- No dedicated automated test directories or co-located `*.test.*` / `*.spec.*` files detected.

**Naming:**
- Automated test naming pattern is not established.

**Structure:**
```
Not detected (no test suite tree present in repository)
```

## Test Structure

**Suite Organization:**
```typescript
// No describe()/it() suite structure detected in repository test files.
```

**Patterns:**
- Validation currently relies on manual route/API checks and runtime behavior.
- Payment/webhook reliability is implemented via database-backed idempotency and status transitions rather than formal unit/integration tests.
- Documentation-driven scenarios exist for billing/payment behavior in `docs/SAAS_BILLING_RU.md` and `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`.

## Mocking

**Framework:** Not applicable (no automated test runner detected).

**Patterns:**
```typescript
// No repository-wide mocking pattern detected (no vi.mock/jest.mock/sinon usage).
```

**What to Mock:**
- When introducing tests, first mock external payment provider calls from `server/utils/yookassa.ts` and Supabase boundaries used in `server/api/checkout/create.post.ts` and `server/api/webhooks/yookassa.post.ts`.

**What NOT to Mock:**
- Do not mock core status-transition rules for payment/webhook mapping; validate these as integration flows around `order_payment_intents` and `payment_webhook_events` tables defined in `supabase/migrations/018_payments_and_requisites.sql`.

## Fixtures and Factories

**Test Data:**
```typescript
// No fixtures/factories directories or helper modules detected.
```

**Location:**
- Not detected.

## Coverage

**Requirements:** None enforced in repository scripts/config.

**View Coverage:**
```bash
Not available (coverage tooling is not configured)
```

## Test Types

**Unit Tests:**
- Not detected.

**Integration Tests:**
- Not detected.

**E2E Tests:**
- Not detected.

## Common Patterns

**Async Testing:**
```typescript
// Automated async test pattern not detected.
// Runtime code uses async/await with explicit error checks in server handlers:
// server/api/checkout/create.post.ts
// server/api/webhooks/yookassa.post.ts
```

**Error Testing:**
```typescript
// Automated error-case tests not detected.
// Error paths are encoded with createError(...) in h3 handlers.
```

## Current Practical Verification Flow (Repository Grounded)

- Verify billing/payment requirements against docs:
  - `docs/SAAS_BILLING_RU.md`
  - `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`
  - `docs/MULTI_TENANT_SAAS.md`
  - `docs/TERMS.md`
- Validate checkout + webhook behavior through live API endpoints:
  - `server/api/checkout/create.post.ts`
  - `server/api/webhooks/yookassa.post.ts`
- Confirm schema prerequisites exist for payment flows:
  - `supabase/migrations/018_payments_and_requisites.sql`

---

*Testing analysis: 2026-04-01*
