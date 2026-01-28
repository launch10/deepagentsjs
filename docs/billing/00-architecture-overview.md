# Credits System Architecture Overview

## Overview

The credits system tracks AI usage across Launch10's two-service architecture (Rails + Langgraph), handles billing through Stripe, and enforces credit limits in real-time.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│  creditStore.ts ← CreditWarningModal / CreditGate                  │
│       ↑ creditStatus stream                                         │
├─────────────────────────────────────────────────────────────────────┤
│                        Langgraph (Hono)                             │
│  creditCheck middleware → graph execution → calculateCreditStatus   │
│       │                    ↓ UsageTracker callback                  │
│       │                    ↓ persistUsage() → llm_usage table       │
│       │                    ↓ notifyRails() ──────────┐              │
│       ↓                                              ↓              │
├─────────────────────────────────────────────────────────────────────┤
│                         Rails (API)                                 │
│  GET /api/v1/credits/check ←─────────────────────────               │
│  POST /api/v1/llm_usage/notify → ChargeRunWorker                   │
│       ↓                                                             │
│  ConsumptionService → CreditTransaction → Account balance update    │
│                                                                     │
│  Stripe Webhooks → RenewalHandler / PlanChangeHandler               │
│       ↓                                                             │
│  AllocationService → CreditTransaction → Account balance update     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: LLM Chat Run

1. **Pre-run check**: Langgraph middleware calls Rails `GET /api/v1/credits/check`
2. **Graph execution**: UsageTracker callback captures token counts per LLM call
3. **Post-run**: `calculateCreditStatusNode` estimates remaining credits
4. **Persistence**: `persistUsage()` writes records to `llm_usage` table
5. **Notification**: `notifyRails()` triggers `ChargeRunWorker` via POST
6. **Charging**: Worker calculates exact cost, calls `ConsumptionService.consume!`
7. **Frontend**: `creditStore` receives `creditStatus` from stream, updates UI

## Key Files Index

### Rails Models
| File | Purpose |
|------|---------|
| `rails_app/app/models/credit_transaction.rb` | Audit log for all credit movements |
| `rails_app/app/models/credit_pack.rb` | Available credit pack definitions |
| `rails_app/app/models/credit_pack_purchase.rb` | Purchase tracking |
| `rails_app/app/models/credit_gift.rb` | Admin-issued gift credits |
| `rails_app/app/models/concerns/millicredits.rb` | Millicredits conversion utilities |
| `rails_app/app/models/concerns/pay_subscription_credits.rb` | Initial subscription credit allocation |

### Rails Services
| File | Purpose |
|------|---------|
| `rails_app/app/services/credits/allocation_service.rb` | Credit allocation (renewal, upgrade, downgrade, packs, gifts) |
| `rails_app/app/services/credits/consumption_service.rb` | Credit consumption with plan/pack splitting |
| `rails_app/app/services/credits/cost_calculator.rb` | Token-to-millicredits conversion |

### Rails Workers
| File | Purpose |
|------|---------|
| `rails_app/app/workers/credits/charge_run_worker.rb` | Process LLM usage into credit charges |
| `rails_app/app/workers/credits/reset_plan_credits_worker.rb` | Allocate/reset plan credits |
| `rails_app/app/workers/credits/daily_reconciliation_worker.rb` | Monthly resets for yearly subscribers |
| `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb` | Backup polling for missed notifications |
| `rails_app/app/workers/credits/allocate_pack_credits_worker.rb` | Credit pack allocation |
| `rails_app/app/workers/credits/allocate_gift_credits_worker.rb` | Gift credit allocation |

### Rails Webhook Handlers
| File | Purpose |
|------|---------|
| `rails_app/app/webhooks/credits/renewal_handler.rb` | Subscription renewal credit reset |
| `rails_app/app/webhooks/credits/plan_change_handler.rb` | Upgrade/downgrade handling |
| `rails_app/app/webhooks/credits/cancellation_handler.rb` | Cancellation (no-op for credits) |

### Rails API
| File | Purpose |
|------|---------|
| `rails_app/app/controllers/api/v1/credits_controller.rb` | Pre-run credit check endpoint |

### Langgraph Billing
| File | Purpose |
|------|---------|
| `langgraph_app/app/core/billing/tracker.ts` | LLM usage callback handler |
| `langgraph_app/app/core/billing/storage.ts` | AsyncLocalStorage for usage context |
| `langgraph_app/app/core/billing/persist.ts` | Write usage to database |
| `langgraph_app/app/core/billing/types.ts` | Billing type definitions |
| `langgraph_app/app/core/billing/creditCheck.ts` | Pre-run balance check |
| `langgraph_app/app/core/billing/creditStatus.ts` | Post-run exhaustion detection |
| `langgraph_app/app/core/billing/notifyRails.ts` | Fire-and-forget charge notification |
| `langgraph_app/app/core/llm/cost.ts` | Cost calculator (mirrors Rails) |
| `langgraph_app/app/server/middleware/creditCheck.ts` | Hono credit check middleware |
| `langgraph_app/app/nodes/core/calculateCreditStatus.ts` | Graph node for credit status |

### Frontend
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/stores/creditStore.ts` | Zustand store for credit state |
| `rails_app/app/javascript/frontend/components/credits/CreditWarningModal.tsx` | Low/exhausted credit modal |
| `rails_app/app/javascript/frontend/components/shared/chat/input/CreditGate.tsx` | Chat input gating |

## Related Docs

- [01-credit-model.md](./01-credit-model.md) - Credit types and data model
- [05-llm-usage-tracking.md](./05-llm-usage-tracking.md) - How LLM usage is captured
- [06-credit-charging.md](./06-credit-charging.md) - How charges are calculated and applied
- [09-stripe-webhooks.md](./09-stripe-webhooks.md) - Webhook-based subscription management
