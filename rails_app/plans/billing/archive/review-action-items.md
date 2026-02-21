# Billing System Review: Action Items

Captured from comprehensive branch review of `finish-credits-system` on 2026-01-27.

**Overall verdict:** Architecture is strong. Accounting model, idempotency, test coverage, and predictive exhaustion pattern are production-grade. These are the remaining items.

---

## Must-Fix for F&F Launch

### 1. Silent failure on unknown models is a revenue leak

**Status:** IN PROGRESS (plan approved — coordinating LLM selection with cost calculator)

`costCalculator.ts:38-44` — if a model isn't in the config map, cost returns 0 with a `console.warn`. If someone deploys a new model or config fetch fails, users get free usage.

**Plan:** Move cost calculator into `core/llm/`, add `hasValidCostConfig()`, throw `UnknownModelCostError` instead of returning 0, filter uncosted models out of `getModels()` with Rollbar alerting. See `scope-11-final-production-readiness.md` plan section for full implementation steps.

### 2. Commit the staged admin UI refactor

**Status:** COMPLETE

Staged (uncommitted) changes:

- Delete `madmin/credit_gifts_controller.rb`, move to `madmin/user/credit_gifts_controller.rb`
- Delete `credit_gift_resource.rb` and `credit_transaction_resource.rb`
- Add new `Madmin/Users/Show.tsx` (244+ lines)

If branch merges without these, old admin controller exists but new one doesn't. Finish the refactor and commit.

### 3. Clean up dead `expire_plan_credits!` method

**Status:** COMPLETE

`ConsumptionService.expire_plan_credits!` is dead code — CancellationHandler is already a no-op (correct per cancellation policy), but the old method is still in the committed code. Remove it.

---

## Should-Fix Before GA

### 4. Credit check race window (document + decide)

**Status:** TODO

Middleware calls `GET /api/v1/credits/check`, gets positive balance, then graph runs. A concurrent graph for the same account could drain credits between check and run. Fail-open design is tolerable (async charging catches up), but:

- Document this in architecture docs
- Consider whether heavy users could abuse it
- The 5-millicredit buffer in `creditStatus.ts` addresses prediction drift, not concurrency

### 5. Both CTAs in modal go to `/subscriptions`

**Status:** TODO

`CreditWarningModal.tsx:126-137` — "Upgrade Plan" and "Purchase Credits" both link to `/subscriptions`. No pack purchase checkout flow is wired up yet. Backend exists (`allocate_pack!`, `CreditPackPurchase`) but no checkout endpoint. Either:

- Build the pack purchase flow (Scope 10), or
- Change CTA text to not mislead (e.g., remove "Purchase Credits" button until packs ship)

### 6. Credit state can flash incorrectly on page load

**Status:** TODO

Zustand store persists only `modalDismissedAt` and `lowCreditWarningDismissedAt` to localStorage. On full page reload, `isOutOfCredits` starts as `false` until `hydrateFromPageProps` runs. Brief window where submit button appears enabled for an exhausted user. Cosmetic but feels wrong.

### 7. AnnualSubscriberMonthlyAllocationWorker plan join is fragile

**Status:** TODO

```ruby
"plans.stripe_id = pay_subscriptions.processor_plan",
"plans.name = pay_subscriptions.processor_plan"
```

If a plan's `name` matches another plan's `stripe_id`, wrong joins occur. The `fake_processor_id` fallback adds a third path. Probably works in production (Stripe IDs are `price_xxx` format) but brittle. Consider tightening to only use `stripe_id` in production.

---

## Missing for Production

### 8. Monitoring/Alerting

**Status:** TODO

No metrics emission for credit operations. Need dashboards for:

- Credit check failures
- Unknown model cost calculations (the 0-cost scenario — partially addressed by item #1)
- Balance drift between predictive and actual
- Overdraft occurrences

### 9. Pack purchase checkout flow

**Status:** TODO (Scope 10)

Backend exists (`allocate_pack!`, `CreditPackPurchase`), frontend doesn't. See Scope 10 in `scope-11-final-production-readiness.md`.

### 10. Credit balance display

**Status:** TODO (Scope 10)

No persistent balance indicator in the UI. Users only see balance when exhaustion/warning modal appears. See Scope 10 in `scope-11-final-production-readiness.md`.
