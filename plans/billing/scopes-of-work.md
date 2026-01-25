# Billing System - Scopes of Work

## Overview

The billing system spans 5 plan documents with significant overlap. This document breaks them into **self-contained, denormalized work scopes** with clear dependencies.

### Summary Table

| Order | Scope     | Name                          | Depends On | Complexity | Risk     |
| ----- | --------- | ----------------------------- | ---------- | ---------- | -------- |
| **0** | 6 (spike) | Langgraph Usage Spike         | None       | Medium     | **HIGH** |
| 1     | 1         | Database Foundation           | Spike      | Low        | Low      |
| 2     | 2         | Rails Core Services           | 1          | Medium     | Low      |
| 3a    | 3         | Subscription Lifecycle        | 2          | Medium     | Low      |
| 3b    | 4         | Credit Pack Purchase          | 2          | Medium     | Low      |
| 3c    | 5         | Admin Gift Credits            | 2          | Low        | Low      |
| 4     | 6 (full)  | Langgraph Full Implementation | 1          | High       | Medium   |
| 5     | 7         | Credit Charging Pipeline      | 2, 6       | Medium     | Low      |
| 6     | 8         | Pre-Run Authorization         | 2, 6       | Low        | Low      |
| 7     | 9         | Frontend Integration          | 2          | Medium     | Low      |
| 8     | 10        | Provider Reconciliation       | 1          | Low        | Low      |

---

## Dependency Graph (Derisk-First Order)

```
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 6 SPIKE: Langgraph Usage Tracking                        │
│  (DO FIRST - validates schema, highest risk)                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 1: Database Foundation                                   │
│  (Schema informed by spike findings)                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 2: Rails Core Services                                   │
│  (Depends on Scope 1)                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  SCOPE 3:     │  │  SCOPE 4:     │  │  SCOPE 5:     │
│  Subscription │  │  Credit Pack  │  │  Admin Gift   │
│  Lifecycle    │  │  Purchase     │  │  Credits      │
│               │  │               │  │               │
│  (Parallel)   │  │  (Parallel)   │  │  (Parallel)   │
└───────────────┘  └───────────────┘  └───────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 6 FULL: Complete Langgraph Integration                   │
│  (After tables exist)                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 7: Credit Charging Pipeline                              │
│  (Depends on Scope 2 + Scope 6)                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 8: Pre-Run Authorization                                 │
│  (Depends on Scope 2 + Scope 6)                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 9: Frontend Integration                                  │
│  (Depends on Scope 2)                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SCOPE 10: Provider Reconciliation                              │
│  (Depends on Scope 1 - llm_usage table)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCOPE 6 SPIKE: Langgraph Usage Tracking (DO FIRST)

**Status**: Not started
**DO FIRST AS SPIKE** - Highest risk, informs schema decisions
**Blocking**: Scopes 1, 7, 8 (schema depends on spike findings)
**Complexity**: Medium
**Source**: langgraph_integration.md, conversation_traces.md

### Why First?

| Risk              | What Could Go Wrong                                        | How Spike Mitigates                                |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Callback timing   | `handleLLMEnd` might not fire for tool-internal LLM calls  | Test with saveAnswersTool, SummarizationMiddleware |
| Usage metadata    | Fields might be named differently than expected            | Inspect actual output, adjust schema               |
| AsyncLocalStorage | Context might not survive agent loops                      | Test multi-turn agent, verify all calls captured   |
| Model names       | Provider returns versioned names we can't match to pricing | Build normalizeModelName with real data            |
| Cache tokens      | Anthropic vs OpenAI have different field locations         | Test both providers                                |

**The spike is cheap.** If it fails, we learn before building migrations.

### Spike Deliverables

1. **usageTracker.ts** (minimal version)
   - AsyncLocalStorage for UsageContext
   - UsageTrackingCallbackHandler with:
     - `handleChatModelStart` - log what we receive
     - `handleLLMEnd` - log usage_metadata structure
   - `runWithUsageTracking()` wrapper

2. **Test harness**
   - Run against brainstormGraph (has agent loops)
   - Run against a graph with tools that call LLMs internally
   - Test with both Anthropic and OpenAI models

3. **Output: Validated Schema**
   ```typescript
   // Document actual fields received:
   interface ValidatedUsageRecord {
     // What handleLLMEnd actually provides
     inputTokens: number; // usage_metadata.input_tokens?
     outputTokens: number; // usage_metadata.output_tokens?
     cacheCreation: number; // Where is this? cache_creation_input_tokens?
     cacheRead: number; // cache_read_input_tokens?
     modelName: string; // response_metadata.model? model_name?
     // ... document actual structure
   }
   ```

### Spike Verification Checklist

- [ ] handleLLMEnd fires for direct model.invoke()
- [ ] handleLLMEnd fires for agent tool loops
- [ ] handleLLMEnd fires for tools calling getLLM() internally
- [ ] handleLLMEnd fires for SummarizationMiddleware
- [ ] AsyncLocalStorage context survives multi-turn agent
- [ ] Anthropic usage_metadata has expected fields
- [ ] OpenAI usage_metadata has expected fields
- [ ] System prompt captured via handleChatModelStart

### Files to Create

- `langgraph_app/scripts/explore-usage-metadata.ts` (spike script)
- `langgraph_app/app/core/billing/usageTracker.ts` (minimal version)

---

## SCOPE 1: Database Foundation

**Status**: Not started
**Depends on**: Scope 6 spike (llm_usage schema validated)
**Blocking**: Scopes 2-5, 7-9
**Complexity**: Low
**Source**: credit-packs.md, credit_transactions.md, langgraph_integration.md, conversation_traces.md

### Deliverables

1. **Migration: credit_transactions**

   ```ruby
   # Fields: account_id, transaction_type, credit_type, reason, amount
   # Running balances: balance_after, plan_balance_after, pack_balance_after
   # Reference: reference_type (string), reference_id (string)
   # Idempotency: idempotency_key (unique)
   ```

2. **Migration: credit_packs**

   ```ruby
   # Fields: account_id, credits_purchased, credits_remaining, price_cents
   # stripe_payment_intent_id, purchased_at, expires_at
   ```

3. **Migration: llm_usage** ⚠️ Schema finalized by Scope 6 spike

   ```ruby
   # Fields: chat_id, run_id, graph_name
   # Tokens: input_tokens, output_tokens, reasoning_tokens, cache_*
   # Billing: cost_usd, processed_at (NULL = not charged)
   # NOTE: Exact token fields depend on spike findings
   ```

4. **Migration: conversation_traces** (partitioned by month)

   ```ruby
   # Fields: chat_id, thread_id, run_id, graph_name
   # Content: messages (jsonb), system_prompt, usage_summary, llm_calls
   ```

5. **Migration: model_configs cache pricing**
   ```ruby
   # Add: cost_cache_write, cost_cache_read columns
   ```

### Files to Create

- `rails_app/db/migrate/XXXX_create_credit_transactions.rb`
- `rails_app/db/migrate/XXXX_create_credit_packs.rb`
- `rails_app/db/migrate/XXXX_create_llm_usage.rb`
- `rails_app/db/migrate/XXXX_create_conversation_traces.rb`
- `rails_app/db/migrate/XXXX_add_cache_pricing_to_model_configs.rb`

### Verification

- `bundle exec rails db:migrate`
- Tables exist with correct columns and indexes

---

## SCOPE 2: Rails Core Services

**Status**: Not started
**Depends on**: Scope 1
**Blocking**: Scopes 3-9
**Complexity**: Medium
**Source**: credit_transactions.md, credit-system-queries.md

### Deliverables

1. **CreditTransaction model**
   - Enums: transaction_type (allocate, consume, purchase, refund, gift)
   - Enums: credit_type (plan, pack)
   - REASONS constant with gift
   - Validations, scopes

2. **CreditPack model**
   - Validations, scopes (visible, active)

3. **LlmUsage model**
   - belongs_to :chat
   - Scopes: unprocessed, for_run

4. **ConversationTrace model** (read-only from Rails)
   - Scopes: for_thread, for_chat

5. **CreditBalance query class**
   - Cached balance lookup (invalidate on write, no TTL)
   - Methods: total, plan, pack, breakdown, usage_percentage

6. **CreditUsageService**
   - FIFO: plan credits first, then pack
   - Negative balance allowed for plan (debt absorbed next month)
   - Pack credits NEVER go negative
   - Subtract pack credits from FIFO pack
   - When pack credits hit zero, mark is_used for pack, and begin deducting from next pack (or go negative on plan balance if no remaining packs)

7. **CreditAllocationService**
   - `allocate_plan_credits!(billing_period:)`
   - `add_pack_credits!(credit_pack:)`
   - `gift!(amount_cents:, gift_reason:, admin:, notes:)`

### Files to Create

- `rails_app/app/models/credit_transaction.rb`
- `rails_app/app/models/credit_pack.rb`
- `rails_app/app/models/llm_usage.rb`
- `rails_app/app/models/conversation_trace.rb`
- `rails_app/app/services/credit_balance.rb`
- `rails_app/app/services/credit_consumption_service.rb`
- `rails_app/app/services/credit_allocation_service.rb`

### Verification

- RSpec tests for each model and service
- Console: create transactions, verify balance updates

---

## SCOPE 3: Subscription Lifecycle

**Status**: Not started
**Depends on**: Scope 2
**Independent of**: Scopes 4, 5, 6, 7, 8
**Complexity**: Medium
**Source**: credit-packs.md (Phase 4)

### Deliverables

1. **Credits::ResetPlanCreditsWorker**
   - Idempotent (check idempotency_key)
   - Zero out old plan credits (expire)
   - Allocate new based on current subscription
   - Absorb any debt from new allocation

2. **PaySubscriptionCredits concern**
   - `after_commit on: :create` → new subscription
   - `after_commit on: :update` → renewal, plan change, cancel
   - Enqueue ResetPlanCreditsWorker with idempotency key

3. **Credits::DailyReconciliationWorker**
   - For yearly subscribers (monthly reset, no Stripe event)
   - Query accounts needing monthly reset
   - Enqueue ResetPlanCreditsWorker

4. **Pay.rb initializer update**
   - Include PaySubscriptionCredits in Pay::Subscription

### Files to Create

- `rails_app/app/workers/credits/reset_plan_credits_worker.rb`
- `rails_app/app/models/concerns/pay_subscription_credits.rb`
- `rails_app/app/workers/credits/daily_reconciliation_worker.rb`

### Files to Modify

- `rails_app/config/initializers/pay.rb`
- `rails_app/config/schedule.rb` (add daily job)

### Verification

- Create subscription → credits allocated
- Renewal → credits reset
- Plan upgrade → credits recalculated
- Cancel → plan credits zeroed, pack preserved

---

## SCOPE 4: Credit Pack Purchase

**Status**: Not started
**Depends on**: Scope 2
**Independent of**: Scopes 3, 5, 6, 7, 8
**Complexity**: Medium
**Source**: credit-packs.md (Credit Packs section)

### Deliverables

1. **Stripe Products/Prices**
   - Small Pack: 500 credits, $25
   - Mid Pack: 1,250 credits, $50
   - Big Pack: 3,000 credits, $100

2. **CreditPacksController**
   - `index` - show available packs
   - `checkout` - create Stripe Checkout session

3. **ChargeExtensions concern**
   - `after_commit on: :create` on Pay::Charge
   - Check metadata for credit_pack_id
   - Enqueue GrantPurchasedCreditsWorker

4. **Credits::GrantPurchasedCreditsWorker**
   - Idempotent
   - Call CreditAllocationService.add_pack_credits!

5. **Seeds for CreditPack records**

### Files to Create

- `rails_app/app/controllers/credit_packs_controller.rb`
- `rails_app/app/workers/credits/grant_purchased_credits_worker.rb`
- `rails_app/db/seeds/credit_packs.rb`

### Files to Modify

- `rails_app/config/initializers/pay.rb` (add ChargeExtensions)
- `rails_app/config/routes.rb`
- `rails_app/config/credentials.yml.enc` (Stripe price IDs)

### Verification

- Purchase pack → Stripe checkout → credits added
- Webhook replay doesn't double-credit (idempotency)

---

## SCOPE 5: Admin Gift Credits

**Status**: Not started
**Depends on**: Scope 2
**Independent of**: Scopes 3, 4, 6, 7, 8
**Complexity**: Low
**Priority**: P2 (Rare Use Case)
**Source**: credit_transactions.md (gift! method)

### Summary

One-off support use case. Keep simple. Admin form: pick account, enter amount, reason. Creates a `CreditTransaction` with `transaction_type: 'gift'`.

### Deliverables

1. **Admin::GiftsController**
   - `new` - simple form with account picker, amount, reason dropdown, notes
   - `create` - call CreditAllocationService.gift!

2. **Gift reason dropdown values**
   - customer_support
   - partnership
   - testing
   - promotional
   - other

3. **Madmin resource for CreditTransaction**
   - View transaction history
   - Filter by type, reason

### Files to Create

- `rails_app/app/controllers/admin/gifts_controller.rb`
- `rails_app/app/views/admin/gifts/` (or React component)
- `rails_app/app/madmin/resources/credit_transaction_resource.rb`

### Files to Modify

- `rails_app/config/routes.rb` (admin namespace)

### Verification

- Admin can issue gift credits
- Transaction appears in history with `transaction_type: 'gift'` and metadata

---

## SCOPE 6 FULL: Langgraph Full Implementation

**Status**: Not started
**Depends on**: Scope 1 (tables must exist), Spike complete
**Blocking**: Scopes 7, 8
**Complexity**: High
**Source**: langgraph_integration.md, conversation_traces.md

### Deliverables

1. **pricing.ts**
   - `normalizeModelName()` - longest-prefix matching
   - `calculateCost()` - input, output, reasoning, cache tokens
   - Load pricing from model_configs table

2. **persistUsage.ts**
   - Direct Postgres write to `llm_usage` table
   - Uses Drizzle ORM

3. **persistTrace.ts**
   - Direct Postgres write to conversation_traces
   - Serialize messages with is_context_message flag

4. **executeWithTracking.ts**
   - Wraps graph.invoke()
   - Writes usage + traces in parallel
   - Calls notifyRails(runId)

5. **notifyRails.ts**
   - POST to /api/v1/llm_usage/notify
   - Fire-and-forget (backup polling exists)

6. **Modify getLLM()**
   - Attach usageTracker callback to all models

7. **Context messages (optional, can defer)**
   - contextMessages.ts replacing pseudoMessages
   - LanggraphAISDK filtering

### Files to Create (Langgraph)

- `langgraph_app/app/core/billing/pricing.ts`
- `langgraph_app/app/core/billing/persistUsage.ts`
- `langgraph_app/app/core/billing/executeWithTracking.ts`
- `langgraph_app/app/core/billing/notifyRails.ts`
- `langgraph_app/app/core/traces/persistTrace.ts`

### Files to Modify (Langgraph)

- `langgraph_app/app/core/llm/llm.ts` (attach callback)
- `langgraph_app/db/schema.ts` (reflect new tables after migration)

### Verification

- Graph execution → records in `llm_usage`
- Graph execution → trace in `conversation_traces`
- Cost calculation matches expected for known token counts

---

## SCOPE 7: Credit Charging Pipeline

**Status**: Not started
**Depends on**: Scope 2 + Scope 6
**Complexity**: Medium
**Source**: langgraph_integration.md (sections 6b-6e), credit_transactions.md

### Deliverables

1. **POST /api/v1/llm_usage/notify endpoint**
   - Receives { run_id }
   - Enqueues ChargeRunWorker

2. **Credits::ChargeRunWorker**
   - Idempotent (skip if already processed)
   - Aggregate cost_usd for run_id
   - Convert to credits
   - Call CreditConsumptionService.consume!
   - Mark records processed_at = NOW

3. **Credits::FindUnprocessedRunsWorker** (backup)
   - Find records WHERE processed_at IS NULL AND created_at < 2 min ago
   - Enqueue ChargeRunWorker for each stale run_id
   - Schedule: every minute

### Files to Create

- `rails_app/app/controllers/api/v1/llm_usage_controller.rb`
- `rails_app/app/workers/credits/charge_run_worker.rb`
- `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb`

### Files to Modify

- `rails_app/config/routes.rb`
- `rails_app/config/schedule.rb` (Zhong)

### Verification

- Langgraph notify → job runs → credits deducted
- Backup job catches missed notifications
- Idempotency: replay doesn't double-charge

---

## SCOPE 8: Pre-Run Authorization

**Status**: Not started
**Depends on**: Scope 7 (Credit Charging Pipeline must be complete so credits exist to check)
**Complexity**: Low
**Source**: credit-system-queries.md, pre-graph-authorization.md

### Summary

Inject `usagePercent` into `getLLM()` calls before graph execution, enabling model selection based on account usage.

### Current State Analysis

**What's Already Done (Scope 6 Full)**:
- `usageTracker.ts` ✅ - Captures clean message traces with deduplication
- `persistTrace.ts` ✅ - Writes traces to `llm_conversation_traces`
- `persistUsage.ts` ✅ - Writes usage to `llm_usage`
- `notifyRails.ts` ✅ - Fire-and-forget notification to Rails
- `executeWithTracking.ts` ✅ - Wires persistence into graph execution
- `getLLM()` ✅ - Already attaches `usageTracker` callback and accepts `usagePercent` parameter

**The Gap**:
`getLLM()` accepts `usagePercent` (line 59: `const usagePercent = options.usagePercent ?? 0`) but **nothing passes it**:
- All callers use default value of 0
- No pre-graph hook fetches account balance from Rails
- No mechanism injects usagePercent into graph state or LLM calls

### Design Decision: AsyncLocalStorage-based Injection (Option B)

Two approaches were considered:

| Approach | Pros | Cons |
|----------|------|------|
| **A: State-based** - Add `usagePercentage` to CoreGraphState, set via pre-graph hook | Explicit, visible in state | Requires updating every node that calls getLLM |
| **B: AsyncLocalStorage-based** - Store in existing UsageContext | Transparent to nodes, no changes needed | Less visible ("magic") |

**Recommended: Option B** - aligns with existing AsyncLocalStorage pattern for usage tracking. This approach:
1. Extends the existing `UsageContext` to include `usagePercent`
2. Fetches account balance in `executeWithTracking()` before graph runs
3. Sets usagePercent in context alongside threadId and accountId
4. `getLLM()` reads from context if not explicitly passed

This is transparent to all nodes - they don't need to know about usage percentages.

### Model Selection Thresholds

| Usage % | Available Models | maxTier |
|---------|-----------------|---------|
| 0-50%   | Opus, Sonnet, Haiku | undefined (all) |
| 50-80%  | Sonnet, Haiku | 2 |
| 80-100% | Haiku only | 3+ |
| 100%+   | Blocked (unless pack credits) | N/A |

### Deliverables

1. **GET /api/v1/credits/balance endpoint** (Rails)
   - Returns: `{ total, plan, pack, usagePercentage }`

2. **checkCredits.ts** (Langgraph)
   ```typescript
   interface CreditBalance {
     total: number;
     plan: number;
     pack: number;
     usagePercentage: number;
   }

   export async function checkCreditBalance(accountId: number): Promise<CreditBalance>
   export function canStartRun(balance: CreditBalance): boolean
   export function getMaxTierForUsage(usagePercentage: number): number
   ```

3. **UsageContext extension**
   - Add `usagePercent` to UsageContext interface
   - Set in `executeWithTracking()` before graph runs

4. **getLLM() update**
   - Read usagePercent from `getUsageContext()?.usagePercent` if not passed explicitly

5. **Test mode support**
   - Skip credit checks with `testCredits` config flag or when `NODE_ENV !== 'production'`

### Files to Create

**Rails**:
- `rails_app/app/controllers/api/v1/credits_controller.rb`

**Langgraph**:
- `langgraph_app/app/core/billing/checkCredits.ts`

### Files to Modify

**Rails**:
- `rails_app/config/routes.rb` - Add route

**Langgraph**:
- `langgraph_app/app/core/billing/usageTracker.ts` - Add usagePercent to UsageContext
- `langgraph_app/app/core/billing/executeWithTracking.ts` - Fetch balance, set usagePercent
- `langgraph_app/app/core/llm/llm.ts` - Read usagePercent from context if not passed

### Verification Checklist

- [ ] High usage (50-80%) → Opus excluded from getLLM
- [ ] Very high usage (80-100%) → Only Haiku available
- [ ] 100% usage + no packs → Graph blocked before execution
- [ ] 100% usage + pack credits → Allowed to run
- [ ] Test mode → Credit checks skipped

---

## SCOPE 9: Frontend Integration

**Status**: Not started
**Depends on**: Scope 2
**Complexity**: Medium
**Source**: credit-packs.md (Phase 6)

### Deliverables

1. **GET /api/v1/credits endpoint**
   - Balance breakdown

2. **GET /api/v1/credits/transactions endpoint**
   - Paginated transaction history
   - Filter by type, reason, date range

3. **React components**
   - CreditBalanceDisplay (header/sidebar)
   - CreditUsageChart (dashboard)
   - TransactionHistory (billing page)
   - CreditPackPurchase (upgrade page)

4. **90% warning alert**
   - Check after each consumption
   - Show in-app notification
   - Optional: email notification

### Files to Create

- `rails_app/app/controllers/api/v1/credits_controller.rb` (extend)
- `rails_app/app/javascript/frontend/components/billing/`
- `rails_app/app/workers/credits/usage_alert_worker.rb` (optional)

### Verification

- Dashboard shows correct balance
- Transaction history loads
- 90% alert triggers

---

## SCOPE 10: Provider Reconciliation

**Status**: Not started
**Depends on**: Scope 1 (llm_usage table must exist)
**Complexity**: Low
**Priority**: P1

### Summary

Automated job to verify our tracked costs match what AI providers are actually billing us. Not a fancy UI - just automated alerting via Blazer query or Zhong cron job.

### Deliverables

1. **Credits::ReconciliationJob** (Zhong scheduled job)

   ```ruby
   # app/workers/credits/reconciliation_job.rb
   class Credits::ReconciliationJob
     include Sidekiq::Worker
     sidekiq_options queue: :low

     def perform
       month = 1.month.ago.all_month

       # Sum our tracked costs
       our_cost = LlmUsage.where(created_at: month).sum(:cost_usd)

       # Group by provider for comparison
       by_provider = LlmUsage.where(created_at: month)
         .group("CASE WHEN model LIKE 'claude%' THEN 'anthropic' WHEN model LIKE 'gpt%' THEN 'openai' ELSE 'other' END")
         .sum(:cost_usd)

       # Alert if > 5% variance from expected (manual input or API)
       # Log to Slack
       SlackNotifier.notify("#billing-alerts", <<~MSG)
         Monthly AI Cost Reconciliation (#{month.first.strftime('%B %Y')})
         Total: $#{our_cost.round(2)}
         By Provider: #{by_provider.map { |k,v| "#{k}: $#{v.round(2)}" }.join(', ')}

         Compare to provider invoices and flag discrepancies > 5%
       MSG
     end
   end
   ```

2. **Blazer query alternative** (if preferred over Zhong job)

   ```sql
   -- Monthly AI Cost by Provider
   SELECT
     DATE_TRUNC('month', created_at) AS month,
     CASE
       WHEN model LIKE 'claude%' THEN 'anthropic'
       WHEN model LIKE 'gpt%' THEN 'openai'
       ELSE 'other'
     END AS provider,
     COUNT(*) AS call_count,
     SUM(input_tokens) AS total_input_tokens,
     SUM(output_tokens) AS total_output_tokens,
     ROUND(SUM(cost_usd)::numeric, 2) AS total_cost_usd
   FROM llm_usage
   WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
     AND created_at < DATE_TRUNC('month', CURRENT_DATE)
   GROUP BY 1, 2
   ORDER BY 1 DESC, 4 DESC
   ```

3. **Schedule** (if using Zhong job)
   - Run: 1st of each month at 9am
   - Slack channel: `#billing-alerts`

### Files to Create

- `rails_app/app/workers/credits/reconciliation_job.rb`

### Files to Modify

- `rails_app/config/schedule.rb` (add Zhong schedule)

### Verification

- Job runs on schedule
- Slack notification received with monthly costs
- Costs grouped by provider match expectations

---

## Recommended Implementation Order

### Phase 0: DERISK - Langgraph Spike (Do First)

**Goal**: Validate that Langgraph callback system works as planned before committing to schema.

1. **SCOPE 6 (partial)**: Langgraph Usage Tracking - Spike
   - Build usageTracker.ts with callback handler
   - Test with real graph invocations
   - **Validate**:
     - [ ] `handleLLMEnd` fires for every LLM call (agents, tools, middlewares)
     - [ ] `usage_metadata` contains expected fields (input_tokens, output_tokens, cache tokens)
     - [ ] `response_metadata` has model name
     - [ ] AsyncLocalStorage context survives across async boundaries
     - [ ] System prompt capture via `handleChatModelStart` works
   - **Output**: Confirmed schema for llm_usage table

### Phase 1: Foundation (After Spike Validates)

2. **SCOPE 1**: Database migrations (now informed by spike findings)
3. **SCOPE 2**: Rails core services

### Phase 2: Langgraph Full Implementation

4. **SCOPE 6 (complete)**: Finish usage tracking
   - persistUsage.ts (write to Postgres)
   - executeWithTracking wrapper
   - getLLM modification

### Phase 3: End-to-End Billing

5. **SCOPE 7**: Credit charging pipeline (Rails job processing)

### Phase 4: Rails-Only Features (Parallel)

6. **SCOPE 3**: Subscription lifecycle
7. **SCOPE 5**: Admin gift credits (quick win)
8. **SCOPE 4**: Credit pack purchase

### Phase 5: Authorization + Frontend

9. **SCOPE 8**: Pre-run authorization
10. **SCOPE 9**: Frontend integration

### Phase 6: Operational (Can Run Anytime After Phase 1)

11. **SCOPE 10**: Provider Reconciliation (Blazer query or Zhong job)
    - Can be implemented as soon as `llm_usage` table exists
    - Automated monthly cost verification

---

## Notes

- **Phase 0 is a spike** - throwaway code is fine, goal is learning
- **Scopes 3, 4, 5 are independent** - can be done in parallel by different people
- **Scope 6 is split** - spike first, then full implementation
- **Schema decisions wait** - llm_usage columns finalized after spike
- **Scope 5 (Gift Credits)** - P2 priority, one-off support use case, keep simple
- **Scope 10 (Reconciliation)** - P1 priority, can run as soon as llm_usage table exists, not a fancy UI - just automated alerting
