# Technology Stack

**Project:** teleShop (B2B QR-order SaaS for quick-service restaurants)  
**Researched:** 2026-04-01  
**Context:** Brownfield evolution on existing Nuxt + Supabase codebase

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Nuxt | `^4.4.0` (target `4.4.x`) | Fullstack app (storefront + dashboard + server APIs) | Current stable Nuxt line in 2026, keeps Vue/Nitro developer model you already use, avoids rewrite cost from Nuxt 3 while enabling long-term support path. |
| Vue | `^3.5.0` | UI layer for storefront and backoffice | Native pairing with Nuxt 4, stable ecosystem, no migration risk for existing Vue SFC code. |
| TypeScript | `^5.6.0` | Type safety for API contracts, role policies, payment state machine | Reduces regressions in role-gated admin and order workflow transitions; already established in codebase. |
| Nitro (Nuxt server) | bundled with Nuxt | API endpoints, webhooks, internal admin APIs | Keeps one deployment unit and shared runtime config for tenant resolution + payment/webhook orchestration. |

### Database & Auth
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Postgres | managed current stable | Multi-tenant relational data, RLS, migrations | Best fit for your current schema and docs: tenant isolation + order/payment audit tables with SQL-first evolution. |
| Supabase Auth | managed current stable | Owner/Manager auth, membership-based access | Native integration with existing stack; supports role-gated dashboard without introducing separate auth service. |
| PostgreSQL RLS policies | current Postgres features | Data isolation by `shop_id`/tenant and role scope | Standard 2026 SaaS baseline for shared-schema multi-tenancy when you already run Supabase. |

### Payments (Russia, domain-specific)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| YooKassa REST API | current API + webhooks | B2C order payments and optional B2B billing rail | Already integrated in runtime; mature local rail with required webhook-first model and 54-FZ documentation path. |
| T-Bank acquiring API (adapter-ready) | current API | Optional second provider and fallback/coverage | Matches your roadmap/docs; keeps provider abstraction for branch-level acquiring and operational resilience. |
| Provider adapter layer (`PaymentProvider` interface in server code) | project-level pattern | Normalize create/check/refund/webhook mapping | Avoids lock-in and duplicated business logic when supporting YooKassa + T-Bank in parallel. |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel (or equivalent Node-compatible serverless host) | current | Web app + Nitro API hosting | Matches current deployment model and speeds up brownfield rollout. |
| Upstash Redis (or managed Redis) | `^7` API-compatible service | Idempotency locks, short-lived checkout/session state, background queue backing | Needed once order-status workflows and retries become asynchronous across webhook/order events. |
| Object storage (Supabase Storage) | managed current stable | Branch branding assets (logos/themes/media) | Keeps branch storefront customization inside existing platform boundary. |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nuxtjs/supabase` | `^2.x` | Nuxt module integration for Supabase clients/helpers | Keep for current architecture; use server-only clients for privileged operations. |
| `zod` | `^3.x` | Runtime validation for API payloads and webhook events | Use on every public API boundary and webhook endpoint. |
| `pinia` | `^2.x` | Client state for dashboard/storefront UX flows | Use for UI/session orchestration only, not as source of truth for payments/orders. |
| `@tanstack/vue-query` | `^5.x` | Server-state cache/invalidation in admin UI | Use for menu publishing, order board polling, role management views. |
| `bullmq` + `ioredis` | `^5.x` / `^5.x` | Background jobs (retries, delayed transitions, notification fan-out) | Introduce when webhook/order workflow complexity exceeds simple inline handlers. |
| `pino` | `^9.x` | Structured JSON logging | Mandatory for payment and webhook observability/auditability. |
| OpenTelemetry JS SDK | `^1.x` (`@opentelemetry/sdk-node`) | Traces/metrics/log correlation across checkout and webhook lifecycle | Use for production debugging of payment/order state transitions and latency. |

## Prescriptive Decisions for This Milestone

1. **Stay on Nuxt and upgrade to 4.4.x, do not replatform.**  
   Brownfield constraint dominates: your value is branch customization + payment/workflow reliability, not framework migration.

2. **Keep Supabase as system of record; enforce stronger RLS + audit tables.**  
   Existing model already aligns with multi-tenant B2B SaaS and webhook-first payments.

3. **Formalize provider abstraction now (YooKassa first, T-Bank second).**  
   This is the cheapest time to prevent hard-coupling before more payment scenarios ship.

4. **Add Redis-backed async processing for order status workflow.**  
   Inline-only processing will become fragile once you add retries, delayed transitions, and operator notifications.

5. **Make observability a first-class part of stack, not an afterthought.**  
   Payment and status bugs are operationally expensive; structured logs + tracing should be baseline.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| App framework | Nuxt 4 | Next.js/NestJS split stack | High rewrite cost, duplicated auth/tenant context logic, slower milestone delivery. |
| Data layer | Supabase Postgres + RLS | Prisma-first service split | Adds abstraction without solving current bottleneck; SQL migrations already core to project. |
| Queue/workflow | BullMQ + Redis | DB cron polling only | Harder retries/priorities/flow orchestration under payment webhook load. |
| Observability | Pino + OpenTelemetry | Console logs only | Insufficient for tracing cross-step failures (checkout -> webhook -> status board). |

## What NOT to Use (in this context)

- **Do not use client-side payment status as source of truth** (`return_url` success pages are UX only).  
- **Do not store acquiring secrets in public runtime config or browser state** (server-only storage and masked UI values only).  
- **Do not introduce microservices now** for orders/payments/admin; premature for current team and scope, increases failure surface.  
- **Do not use schema-per-tenant or DB-per-tenant at this stage**; shared schema + robust RLS is the practical default for current scale and existing model.  
- **Do not couple business workflow directly to provider-specific statuses**; always map to internal canonical payment/order states.  

## Installation

```bash
# Core upgrades (brownfield-safe path)
npm install nuxt@^4.4.0 vue@^3.5.0 typescript@^5.6.0

# Validation + server state + workflow
npm install zod @tanstack/vue-query bullmq ioredis

# Observability
npm install pino @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

## Confidence Assessment

| Recommendation Area | Confidence | Notes |
|---------------------|------------|-------|
| Nuxt 4.4.x baseline | HIGH | Verified by Nuxt official release stream (v4.4.x published 2026-03). |
| Supabase + RLS for tenancy | HIGH | Verified by Supabase production checklist and existing project architecture fit. |
| Webhook-first payment truth | HIGH | Confirmed by your existing domain docs and YooKassa webhook-centric model. |
| Redis + BullMQ for order workflows | MEDIUM | Strong ecosystem pattern and official BullMQ flows docs; exact adoption timing depends on projected event volume. |
| OpenTelemetry + Pino baseline | MEDIUM | Industry-standard and official OTel JS docs; final backend choice for telemetry sink remains implementation detail. |

## Sources

- Nuxt release notes (official): [https://github.com/nuxt/nuxt/releases/tag/v4.4.0](https://github.com/nuxt/nuxt/releases/tag/v4.4.0)  
- Supabase production checklist (official): [https://supabase.com/docs/guides/deployment/going-into-prod](https://supabase.com/docs/guides/deployment/going-into-prod)  
- YooKassa webhooks/docs (official): [https://yookassa.ru/developers/using-api/webhooks](https://yookassa.ru/developers/using-api/webhooks)  
- BullMQ flows/docs (official): [https://docs.bullmq.io/guide/flows](https://docs.bullmq.io/guide/flows)  
- OpenTelemetry JS instrumentation (official): [https://opentelemetry.io/docs/languages/js/instrumentation/](https://opentelemetry.io/docs/languages/js/instrumentation/)  
- Project context docs: `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `docs/TERMS.md`, `docs/SAAS_BILLING_RU.md`, `docs/PAYMENTS_RU_YOOKASSA_TBANK.md`, `docs/MULTI_TENANT_SAAS.md`
