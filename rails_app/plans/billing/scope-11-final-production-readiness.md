# Scope 11: Final Production Readiness - The Last 10%

## Overview

This document captures the remaining work to make the billing system production-ready. Created from comprehensive code exploration on 2026-01-26.

**Key Finding:** Scope 9 (Credit Exhaustion) is **complete** despite the roadmap marking it "Not Started".

---

## What's Complete

### Infrastructure (Scopes 1-7)
- ✅ All credit models (CreditTransaction, CreditPack, CreditPackPurchase, CreditGift, LlmUsage)
- ✅ All services (AllocationService, ConsumptionService, CostCalculator, ModelNormalizer)
- ✅ All workers (Reset, Allocate Pack/Gift, Charge, FindUnprocessed, DailyReconciliation)
- ✅ Webhook handlers (Renewal, PlanChange)
- ✅ 30+ integration tests

### Credit Exhaustion (Scope 9)
- ✅ Rails `/api/v1/credits/check` endpoint
- ✅ Langgraph: costCalculator, creditCheck, creditStatus, middleware
- ✅ Frontend: OutOfCreditsModal, creditStore, ChatContext detection, SubmitButton guard
- ✅ E2E tests: exhaustion flow, modal dismiss, submit guard
- ✅ Unit tests: creditStore (30+ tests)

---

## What Remains

### Scope 11a: 80% Usage Warning (LowCreditWarning)
**Priority:** HIGH

**Requirements:**
- Shows when plan credit usage exceeds 80%
- Dismissable with 24-hour timeout
- "Purchase credits" and "View usage" CTAs
- Appears in header/sidebar area

**Files:**
- `components/credits/LowCreditWarning.tsx`
- `components/credits/LowCreditWarning.test.tsx`
- E2E test in `e2e/credits/`

**Technical Considerations:**
- Hydration across Inertia pages via `inertia_share`
- May need to integrate creditStore with coreStore for multi-page hydration
- Test: reload page after credit warning, assert state persists

### Scope 11b: Gifting Credits UI
**Priority:** HIGH

**Requirements:**
- Admin can gift credits to any account
- Select reason from dropdown (customer_support, promotional, compensation, beta_testing, referral_bonus, other)
- Add notes
- View gift history

**Files:**
- `app/madmin/resources/credit_gift_resource.rb`
- Frontend admin page for gift creation
- Tests

### Scope 11c: Subscription Cancellation Policy
**Priority:** HIGH

**Policy Decision:** Credits are unchanged when subscription is cancelled. Subscription simply does not renew.

**Implementation:**
- No credit expiration on cancellation
- User keeps existing plan + pack credits
- No new allocation on would-be renewal date
- User can still use remaining credits

---

## Full Scope 10 Remaining Items (Lower Priority)

### API Endpoints
- `GET /api/v1/credits` - Detailed balance breakdown
- `GET /api/v1/credits/transactions` - Paginated transaction history
- `GET /api/v1/credit_packs` - Available packs for purchase
- `POST /api/v1/credit_packs/:id/purchase` - Initiate Stripe checkout

### Frontend Components
- `CreditBalanceDisplay` - Header/sidebar widget
- `TransactionHistory` - Paginated table
- `CreditPackPurchaseCard` - Pack options UI
- `CreditUsageChart` - Usage over time
- `/settings/credits` page

### Admin Resources
- CreditTransaction admin (view-only ledger)
- CreditPack admin (CRUD packs)
- Account credits section

---

## Testing Requirements

### Inertia Page Transition Tests
Must verify credit state persists across page transitions:
1. User exhausts credits on Page A
2. Navigate to Page B
3. Assert credit exhaustion state is preserved
4. Assert submit buttons are locked

**Implementation Options:**
1. Integrate creditStore with coreStore for hydration
2. Add credits to `inertia_share` controller concern
3. Test by reloading page after credit failure

### E2E Test Coverage Needed
- Low credit warning (80% threshold)
- Warning dismiss with 24-hour timeout
- Pack purchase flow
- Balance display updates across pages

---

## Production Validation Checklist

- [ ] Stripe webhooks (invoice.paid, subscription.updated)
- [ ] Yearly subscriber monthly reset
- [ ] Credit pack purchase end-to-end
- [ ] Admin gift allocation
- [ ] Model pricing sync to Langgraph
- [ ] Balance drift monitoring

---

## Open Questions

1. Credit Expiration Display: Should we show "X credits expiring on Y date"?
2. Usage Breakdown: Should transaction history show which feature used credits?
3. Subscription Pause: How do credits behave? (Not addressed yet)
