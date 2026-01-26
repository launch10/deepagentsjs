# Launch10 Billing System: Roadmap

## Executive Summary

The billing system is **~70% complete**. Core infrastructure for credit allocation, consumption, and charging is fully implemented with comprehensive test coverage. What remains is pre-run authorization (blocking users who are out of credits), frontend integration, and optional reconciliation.

---

## Current State (What's Done)

### Infrastructure Complete

| Component | Status | Key Files |
|-----------|--------|-----------|
| **Database Schema** | ✅ | `credit_transactions`, `credit_packs`, `credit_pack_purchases`, `credit_gifts`, `llm_usage` |
| **Credit Allocation** | ✅ | `Credits::AllocationService`, `Credits::ResetPlanCreditsWorker` |
| **Subscription Lifecycle** | ✅ | `PaySubscriptionCredits`, `RenewalHandler`, `PlanChangeHandler` |
| **Pack Purchases** | ✅ | `CreditPackPurchase`, `AllocatePackCreditsWorker` |
| **Admin Gifts** | ✅ | `CreditGift`, `AllocateGiftCreditsWorker` |
| **Cost Calculation** | ✅ | `Credits::CostCalculator`, `Credits::ModelNormalizer` |
| **Credit Consumption** | ✅ | `Credits::ConsumptionService` |
| **Charging Pipeline** | ✅ | `ChargeRunWorker`, `FindUnprocessedRunsWorker`, `LlmUsageController#notify` |
| **Yearly Reset** | ✅ | `DailyReconciliationWorker` |

### Test Coverage

- `spec/integration/credits/subscription_lifecycle_spec.rb` - 30+ scenarios covering full lifecycle
- `spec/integration/credits/pack_purchase_spec.rb` - Pack purchase flow
- `spec/integration/credits/admin_gift_spec.rb` - Gift allocation
- Unit tests for all services and workers

### Key Architecture Decisions Already Made

1. **Millicredits**: All internal calculations use millicredits (1 credit = 1000 millicredits) for precision
2. **Two Credit Sources**: Plan credits (expire at renewal) + Pack credits (persist until used)
3. **Consumption Priority**: Plan credits first → Pack credits second → Plan overdraft
4. **Idempotency**: All operations use `idempotency_key` in `CreditTransaction`
5. **Webhook-Driven**: Renewals/plan changes via Stripe webhooks, not ActiveRecord callbacks

---

## Remaining Work

| Scope | Name | Priority | Status | Doc |
|-------|------|----------|--------|-----|
| 9 | Credit Exhaustion Detection & Frontend Lock | **Critical** | Not Started | [scope-9-credit-exhaustion.md](scope-9-credit-exhaustion.md) |
| 10 | Frontend Integration (Balance Display & Packs) | High | Not Started | [scope-10-frontend-integration.md](scope-10-frontend-integration.md) |
| 11 | Provider Reconciliation | Low | Deferred | - |

### Implementation Order

```
Scope 9 (Credit Exhaustion)  ← NEXT - Critical for preventing unpaid usage
    ↓
Scope 10 (Frontend)          ← User-facing visibility
    ↓
Scope 11 (Reconciliation)    ← Nice-to-have, can defer
```

---

## Current vs Goal State

| Capability | Today | Goal |
|------------|-------|------|
| Allocate credits on subscription | ✅ | ✅ |
| Renew credits monthly | ✅ | ✅ |
| Handle upgrades/downgrades | ✅ | ✅ |
| Sell credit packs | ✅ (backend) | ✅ + UI |
| Give admin gifts | ✅ | ✅ |
| Track LLM usage | ✅ | ✅ |
| Charge for usage | ✅ (async) | ✅ (async unchanged, predictive UX) |
| Block when out of credits | ❌ | ✅ |
| Show exhaustion modal | ❌ | ✅ |
| Lock chat inputs when exhausted | ❌ | ✅ |
| Show balance to users | ❌ | ✅ |
| Show transaction history | ❌ | ✅ |
| Low credit warnings (80%) | ❌ | ✅ |
| Cost reconciliation | ❌ | Deferred |

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Model tier restrictions | **No** - Simple block at 100%, no tiering |
| Exhaustion detection | **Predictive** - Langgraph calculates cost locally, derives `justExhausted` from pre/post balance diff. No synchronous Rails call (avoids account locking in web request). |
| Fire-and-forget | **Unchanged** - Rails continues to receive async notifications for authoritative accounting |
| Warning threshold | **80%** |
| Reconciliation | **Deferred** - Not needed for MVP |

---

## Timeline Summary

| Scope | Estimated Duration |
|-------|-------------------|
| Scope 9 | ~5.5 days |
| Scope 10 | ~3.5 days |
| **Total** | **~9 days** |
