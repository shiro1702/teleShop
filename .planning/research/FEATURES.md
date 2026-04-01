# Feature Landscape

**Domain:** B2B QR-order SaaS for quick-service restaurants (branch QR, self-pickup, online payment)
**Researched:** 2026-04-01

## Table Stakes

Features users expect. Missing = product feels incomplete for v1 launch.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Branch-scoped QR storefront (city + tenant + branch context) | Core entrypoint in QSR flow: scan -> menu -> checkout without app install | Med | Must open correct branch context from QR and keep it through cart/checkout. |
| Fast mobile checkout without mandatory account | High conversion depends on low-friction flow in peak hours | Med | Guest checkout first; minimize fields; keep <60s target from scan to payment intent. |
| Online payment with provider redirect + webhook-first reconciliation | Reliable payment status is mandatory for paid self-service orders | High | `return_url` is UX only; webhook is source of truth; idempotent event handling required. |
| Real-time menu availability (86/out-of-stock) and price sync | Guests expect unavailable items not to be purchasable | Med | Branch overrides and stop-list must be reflected instantly in storefront. |
| Order lifecycle visibility in dashboard (new -> in progress -> ready/complete -> canceled) | Operators need immediate control during rush hours | Med | Status model should remain separate from payment status. |
| Role-based dashboard access (Owner/Manager scopes) | B2B admins expect secure delegation | Med | Owner-only actions for payment credentials/integrations, manager granularity for operations. |
| Branch operations settings (hours, pickup availability, basic branding) | Multi-branch operators need per-branch control | Med | Align wording: dashboard "Филиал", storefront "Ресторан". |
| Basic operational notifications (new paid order, payment failure) | Staff needs immediate signal to avoid missed orders | Low | Telegram and dashboard-level notifications are enough for v1. |

### Table Stakes Complexity Notes

- **Low:** Notification wiring and status UX if event model is stable.
- **Medium:** Branch context continuity, role-gated dashboard, stop-list propagation.
- **High:** Payment reliability, webhook idempotency, order-payment state consistency.

## Differentiators

Features that create measurable advantage in this project context but are not strict v1 gatekeepers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Branch-level theming/domain policy by plan | Improves B2B perceived control and monetization path (`basic/pro/enterprise`) | Med | Supports clear upsell narrative from platform look to stronger white-label. |
| Built-in QR management per branch (general QR, cashier QR, table QR-ready) | Faster rollout for operators; reduces operational friction | Med | v1 can ship "general + cashier QR"; table-number variants can be dormant-ready. |
| Payment provider fallback strategy (shop default + optional branch override) | Handles real merchant setups where branches differ by acquiring contract | High | Keep fallback-compatible API now; full branch override can be phased. |
| Lightweight operational analytics for QSR (conversion, paid orders, prep time proxy) | Gives immediate business value beyond "just order taking" | Med | Start with branch/day slices and conversion from scan to paid. |
| Fast onboarding template for new branch (clone menu/settings) | Multi-branch expansion speed is a selling point in B2B SaaS | Med | Reduces setup cost and supports branch growth in paid plans. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full delivery logistics (zones/tariffs/courier dispatch optimization) | Contradicts v1 self-pickup scope; high complexity and support burden | Keep strict self-pickup flow; revisit delivery in next milestone. |
| Heavy loyalty engine (tiers, points shop, campaign automation) | Dilutes focus from core QR -> paid order reliability | Ship lean repeat-order/CRM hooks later after stable core ops. |
| Mandatory registration before checkout | Proven conversion killer in QR flows | Guest checkout by default; optional identity capture post-payment. |
| Deep POS/ERP bidirectional sync for all workflows in v1 | Integration breadth risks timeline and reliability | Keep minimal status export/import boundaries and webhook-safe architecture. |
| Multi-currency/multi-country tax complexity in first release | Not required for immediate RU market fit and adds legal/tech risk | Focus RUB + local provider compliance first. |
| Over-configurable branch feature matrix from day one | Creates admin complexity and support overhead | Provide opinionated defaults + a small set of high-impact toggles. |

## Feature Dependencies

```text
Tenant + city routing -> Branch QR context resolution -> Storefront rendering
Menu model (base + branch override + stop-list) -> Valid cart totals -> Payment intent creation
Payment intent creation -> Provider webhook verification -> Final payment status -> Order lifecycle progression
Membership/RBAC -> Safe admin actions (credentials, branch settings, status transitions)
Order events/timeline -> Notifications -> Basic analytics
```

## MVP Recommendation

Prioritize:
1. Branch-scoped QR storefront + fast guest checkout
2. Reliable online payments (webhook-first, idempotent, observable)
3. Admin control loop: branch settings, menu availability, order statuses, role-gated access

Defer: Delivery logistics, full loyalty/promos, deep omni-channel integrations, advanced white-label and branch-level acquiring override UI (keep architecture-ready but not full productized in v1).

## Sources

- Square Help: [Set up and manage QR code ordering](https://squareup.com/help/ie/en/article/7142-set-up-self-serve-ordering-and-qr-codes-with-square-online) (official docs, MEDIUM confidence)
- Toast Support: [Toast Mobile Order & Pay Overview](https://support.toasttab.com/article/Mobile-Order-and-Pay-Overview) (official docs, updated 2026, HIGH confidence)
- Square product page: [QR code ordering for restaurants](https://square.site/us/en/online-ordering/qr-code-ordering) (vendor source, MEDIUM confidence)
- GloriaFood feature pages: [Online ordering system](https://www.gloriafood.com/online-food-ordering-and-delivery-system), [QR code restaurant menu](https://www.gloriafood.com/qr-code-restaurant-menu) (vendor source, LOW-MEDIUM confidence)
- Industry pattern cross-check (implementation pitfalls): [Sunday - common QR mistakes](https://sundayapp.com/en-gb/common-mistakes-to-avoid-with-qr-code-ordering-2/), [Storekit - multi-site QR pitfalls](https://storekit.com/post/7-mistakes-multi-site-restaurant-groups-make-with-qr-ordering-and-how-to-fix-them-8) (community/vendor content, LOW confidence)

