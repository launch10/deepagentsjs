# Credit System Query Patterns

## Overview

This document defines the query patterns the credit system must support, their frequency, accuracy requirements, and proposed storage/caching strategies.

Credits are the currency for LLM operations. Users receive credits from:
1. **Plan allocation** - Monthly credits included with subscription tier
2. **Credit packs** - One-time purchases that add to balance

---

## Query Patterns

### 1. Pre-LLM-Run Authorization Check

**Question**: "What percentage of credits has this user consumed this billing period?"

**Purpose**: Determine which LLM models are available to the user. Langgraph already handles model selection based on usage percentage.

**Frequency**: Every LLM request (HIGH - potentially thousands/day per active user)

**Accuracy**: Medium-high. A few % drift is acceptable; user won't notice if they get Sonnet at 74% vs 75%.

**Latency requirement**: <10ms ideally, <50ms acceptable

**Thresholds** (example):
- 0-50% usage → All models available (Opus, Sonnet, Haiku)
- 50-80% usage → Sonnet + Haiku only
- 80-100% usage → Haiku only
- 100%+ → Blocked

---

### 2. Near-OOC (Out of Credits) Cutoff Check

**Question**: "Has this user hit 100% usage for this billing period?"

**Purpose**: Gate at the START of a graph run. Once a run starts, we allow it to complete (even if it goes negative).

**Frequency**: Every graph run start (HIGH)

**Accuracy**: Medium-high. We check at run START, not during. If user is at 99% and run pushes them to 105%, that's fine - debt absorbed next month.

**Latency requirement**: Same as #1

**Implementation**:
- Calculate: `usage_pct = 1 - (plan_balance_after / plan_tier.credits)`
- If `usage_pct >= 100%` AND `pack_balance_after <= 0`, block new runs
- Once run starts, it completes regardless of credit consumption

---

### 3. 90% Warning Alert

**Question**: "Has this user crossed the 90% usage threshold this period?"

**Purpose**: Trigger email/in-app notification warning user they're almost out.

**Frequency**: LOW - checked periodically (hourly cron?) or event-driven after each credit consumption

**Accuracy**: Medium. Off by a few % is fine - user just gets notified slightly early/late.

**Latency requirement**: None (async background job)

**Implementation options**:
- Event-driven: After each credit consumption, check if crossed threshold
- Periodic: Hourly job scans accounts, sends alerts for newly-crossed thresholds
- Hybrid: Maintain a `last_alert_threshold` field, only query/alert when consumption might cross next threshold

---

### 4. Plan vs Pack Credit Breakdown

**Question**: "How many of my remaining credits are from my plan vs purchased packs?"

**Purpose**: User dashboard display. Help users understand their credit sources.

**Frequency**: LOW - page loads on billing/usage pages

**Accuracy**: High (for display purposes)

**Latency requirement**: <200ms acceptable (page load)

**Complexity**: Requires tracking credit source. Options:
- **FIFO consumption**: Plan credits consumed first, then packs
- **Proportional consumption**: Each transaction consumes proportionally from each source
- **Explicit pools**: Separate balance columns for plan vs pack credits

**Recommendation**: FIFO is simplest to implement and explain to users. "Your plan credits are used first, then your purchased packs."

---

### 5. Historical Usage for Accounting/Billing

**Question**: "What was this account's credit usage for [month/quarter/year]?"

**Purpose**: Invoices, tax records, usage reports, chargeback disputes

**Frequency**: Very low (monthly billing runs, occasional support queries)

**Accuracy**: EXACT - must match what was charged

**Latency requirement**: Seconds acceptable (report generation)

**Requirements**:
- Full audit trail of every credit transaction
- Immutable records (no deletes, only corrections via new entries)
- Ability to reconstruct balance at any point in time

---

### 6. Admin Dashboard: Usage Across All Accounts

**Question**: "Which accounts are heavy users? Who's approaching limits?"

**Purpose**: Business intelligence, capacity planning, identifying power users

**Frequency**: Low (admin page loads, daily reports)

**Accuracy**: Medium (trends matter more than precision)

**Latency requirement**: <2s acceptable for dashboards

---

### 7. Burn Rate / Forecasting

**Question**: "At this rate, when will the user run out of credits?"

**Purpose**: Proactive notifications ("You'll run out in ~3 days")

**Frequency**: Low (dashboard display, weekly email digests)

**Accuracy**: Approximate (it's a forecast)

**Latency requirement**: <500ms for dashboard, async for emails

---

### 8. Feature-Level Breakdown

**Question**: "How many credits did I spend on brainstorm vs website generation vs ads?"

**Purpose**: Help users understand where credits go, optimize usage

**Frequency**: Low (usage analytics page)

**Accuracy**: Exact

**Latency requirement**: <500ms

---

### 9. Per-Project Breakdown

**Question**: "How many credits did Project X consume?"

**Purpose**: Users with multiple projects want to see per-project costs

**Frequency**: Low (project detail pages)

**Accuracy**: Exact

**Latency requirement**: <500ms

---

## Proposed Data Model

### Core Tables

```
credit_transactions
├── id (bigint, PK)
├── account_id (FK, not null)
├── transaction_type (string: allocate, consume, purchase, refund, adjust, expire)
├── credit_type (string: plan, pack)
├── reason (string: ai_generation, plan_renewal, pack_purchase, support_credit, expiration, etc.)
├── amount (integer, positive=credit, negative=debit)
├── balance_after (integer) -- total running balance (plan + pack)
├── plan_balance_after (integer) -- plan credits remaining after this transaction
├── pack_balance_after (integer) -- pack credits remaining after this transaction
├── reference_type (string, nullable) -- string-based: "llm_run", "CreditPack", "Pay::Subscription", etc.
├── reference_id (string, nullable) -- UUID for llm_run, integer as string for models
├── metadata (jsonb) -- contextual data (run_id, graph, model, etc.)
├── created_at (timestamp)
├── idempotency_key (string, unique, nullable) -- prevent duplicate transactions
└── INDEXES:
    ├── (account_id, created_at DESC) -- current balance lookup
    ├── (reference_type, reference_id) -- find transactions for a given resource
    └── (idempotency_key) UNIQUE WHERE NOT NULL

credit_packs (pack TYPE definitions - like Plan)
├── id (bigint, PK)
├── name (string, not null, unique) -- "Small", "Mid", "Big"
├── credits (integer, not null) -- 500, 1250, 3000
├── amount (integer, not null) -- price in cents (2500, 5000, 10000)
├── currency (string, default 'usd')
├── stripe_price_id (string) -- links to Stripe Price
├── visible (boolean, default true) -- show in UI
└── timestamps

credit_pack_purchases (purchase INSTANCES - like Pay::Subscription)
├── id (bigint, PK)
├── account_id (FK, not null)
├── credit_pack_id (FK, not null)
├── pay_charge_id (FK, nullable) -- links to Pay::Charge
├── credits_purchased (integer, not null) -- snapshot at purchase time
├── price_cents (integer, not null) -- snapshot at purchase time
├── is_used (boolean, default false) -- true when fully consumed
├── timestamps
└── INDEXES:
    ├── (account_id, is_used) -- for calculating active allocation
    └── (account_id, created_at) -- ordering
```

### Transaction Examples

```ruby
# Monthly plan credit allocation (start of billing period)
CreditTransaction.create!(
  account: account,
  transaction_type: "allocate",
  credit_type: "plan",
  reason: "plan_renewal",
  amount: 2000,
  balance_after: 2000,
  plan_balance_after: 2000,
  pack_balance_after: 0,
  reference: subscription,
  metadata: { plan_tier: "starter", billing_period: "2025-02" }
)

# AI generation consuming plan credits (references run_id, not a model)
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -10,
  balance_after: 1990,
  plan_balance_after: 1990,
  pack_balance_after: 0,
  reference_type: "llm_run",
  reference_id: run_id,  # UUID string, not a model ID
  metadata: { graph: "brainstorm", llm_call_count: 3, cost_usd: 0.0234 }
)

# Credit pack purchase (references CreditPackPurchase, not CreditPack)
CreditTransaction.create!(
  account: account,
  transaction_type: "purchase",
  credit_type: "pack",
  reason: "pack_purchase",
  amount: 500,
  balance_after: 2490,
  plan_balance_after: 1990,
  pack_balance_after: 500,
  reference_type: "CreditPackPurchase",
  reference_id: credit_pack_purchase.id.to_s,
  metadata: { pack_name: "Small", price_cents: 2500, charge_id: charge.id }
)

# Large generation that exhausts plan and dips into pack
# (This would be TWO transactions in practice - one for plan, one for pack)
# Transaction 1: Consume remaining plan credits
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -1990,  # all remaining plan credits
  balance_after: 500,
  plan_balance_after: 0,
  pack_balance_after: 500,
  reference_type: "llm_run",
  reference_id: run_id,
  metadata: { graph: "website", partial: true }
)
# Transaction 2: Consume from pack for remainder
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "pack",
  reason: "ai_generation",
  amount: -100,
  balance_after: 400,
  plan_balance_after: 0,
  pack_balance_after: 400,
  reference_type: "llm_run",
  reference_id: run_id,  # same run
  metadata: { graph: "website" }
)

# Going negative (allowed - PLAN goes negative, pack NEVER goes negative)
# When pack is exhausted, further consumption causes plan to go negative
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",  # plan absorbs debt, pack is already at 0
  reason: "ai_generation",
  amount: -450,
  balance_after: -50,
  plan_balance_after: -50,  # plan goes negative
  pack_balance_after: 0,    # pack stays at 0, NEVER goes negative
  reference_type: "llm_run",
  reference_id: run_id,
  metadata: { graph: "ads" }
)

# Next month's renewal with negative balance
# Debt is absorbed by new allocation
CreditTransaction.create!(
  account: account,
  transaction_type: "allocate",
  credit_type: "plan",
  reason: "plan_renewal",
  amount: 2000,
  balance_after: 1950,  # -50 + 2000 = 1950
  plan_balance_after: 1950,  # new plan credits minus debt (2000 - 50 = 1950)
  pack_balance_after: 0,  # pack was already at 0 (pack NEVER goes negative)
  reference_type: "Pay::Subscription",
  reference_id: subscription.id.to_s,
  metadata: { plan_tier: "starter", billing_period: "2025-03", debt_absorbed: 50 }
)

# Support credit (always as pack)
CreditTransaction.create!(
  account: account,
  transaction_type: "adjust",
  credit_type: "pack",
  reason: "support_credit",
  amount: 100,
  balance_after: 2050,
  plan_balance_after: 1950,
  pack_balance_after: 100,
  reference: nil,
  metadata: { support_ticket: "TICK-1234", agent: "brett@launch10.com" }
)
```

---

## Query Strategy: Ledger with Running Balances

Every transaction stores three balance snapshots:
- `balance_after` - total credits
- `plan_balance_after` - plan credits remaining
- `pack_balance_after` - pack credits remaining

The most recent transaction IS the current state. No checkpoint layer needed.

### Read Pattern (Current Balance)

```ruby
class CreditBalance
  # No TTL - cache is invalidated synchronously on every write
  # This ensures accurate balances during rapid usage

  def self.for_account(account)
    Rails.cache.fetch("credit_balance:#{account.id}") do
      account.credit_transactions
        .order(created_at: :desc)
        .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]
    end
  end

  def self.total(account)
    for_account(account)[0]
  end

  def self.plan_balance(account)
    for_account(account)[1]
  end

  def self.pack_balance(account)
    for_account(account)[2]
  end

  def self.breakdown(account)
    total, plan, pack = for_account(account)
    { total: total, plan: plan, pack: pack }
  end
end
```

### Write Pattern (Atomic with Lock)

```ruby
Account.transaction do
  account.lock!  # prevent concurrent balance modifications

  last = account.credit_transactions
    .order(created_at: :desc)
    .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]

  current_total, current_plan, current_pack = last

  # Calculate new balances based on credit_type
  if credit_type == "plan"
    new_plan = current_plan + amount
    new_pack = current_pack
  else
    new_plan = current_plan
    new_pack = current_pack + amount
  end
  new_total = new_plan + new_pack

  CreditTransaction.create!(
    account: account,
    amount: amount,
    credit_type: credit_type,
    balance_after: new_total,
    plan_balance_after: new_plan,
    pack_balance_after: new_pack,
    ...
  )

  # Invalidate cache
  Rails.cache.delete("credit_balance:#{account.id}")
end
```

### Why This Works

| Query | Implementation | Performance |
|-------|---------------|-------------|
| Current total balance | `ORDER BY created_at DESC LIMIT 1` | O(1) with index |
| Plan vs pack breakdown | Same query, different columns | O(1) with index |
| Historical balance at time T | Find transaction at time T | O(log n) |
| Usage percentage | `1 - (plan_balance / plan_tier.credits)` | O(1) |
| Transactions for a run | `WHERE reference_type='llm_run' AND reference_id=?` | O(log n) |

### Cache Strategy

- **Hot path (pre-LLM check)**: Cache all three balances (no TTL)
- **Invalidation**: Delete cache key synchronously on every write (not TTL-based)
- **Cache miss**: Single indexed query returning 3 columns
- **Why synchronous**: Ensures accurate balances during rapid usage - TTL would cause drift

### Partitioning (Future)

If transactions table grows huge, partition by `created_at` (monthly). Current balance query only hits the most recent partition.

---

## Accuracy Guarantees

### For Pre-Run Check (Query #1 & #2)

With synchronous cache invalidation, balances are accurate immediately after writes. The pre-run check:

1. **Checks at run START**: If user is at 98% and run pushes them to 105%, that's fine - run completes, debt absorbed next month.
2. **Negative balance allowed for plan**: No hard cutoff on plan credits - they can go negative (debt absorbed next month).
3. **Pack credits protected**: Pack credits can NEVER go negative - consumption stops at 0.
4. **Model selection is soft**: If user gets Sonnet instead of Opus based on usage %, it's not a critical failure.

### For 90% Alert (Query #3)

Threshold alerts are idempotent - sending twice is fine, missing once is fine. Options:
- **Event-driven**: Check threshold after each consumption transaction
- **Periodic**: Hourly job scans for accounts that crossed 90%

Event-driven is more responsive but adds slight overhead to every write.

---

## Plan vs Pack Credit Consumption (FIFO)

See [langgraph_integration.md](./langgraph_integration.md) for how usage is batched at the graph run level.

```ruby
class CreditConsumptionService
  def initialize(account)
    @account = account
  end

  # Called by Credits::ChargeRunWorker after llm_usage are written
  # Returns array of transactions created
  #
  # IMPORTANT: Negative balance rules:
  # - Plan credits CAN go negative (debt absorbed next month)
  # - Pack credits can NEVER go negative
  # - Consumption order: plan (if positive) → pack (if positive) → plan goes negative
  def consume!(amount:, reason:, reference_id:, reference_type:, metadata: {})
    transactions = []
    remaining = amount

    Account.transaction do
      @account.lock!  # prevent concurrent balance modifications

      # Get current state from most recent transaction
      current = @account.credit_transactions
        .order(created_at: :desc)
        .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]

      total_balance, plan_balance, pack_balance = current

      # Step 1: Consume from plan credits first (if positive)
      if plan_balance > 0 && remaining > 0
        plan_consumed = [remaining, plan_balance].min
        remaining -= plan_consumed

        new_plan = plan_balance - plan_consumed
        new_total = total_balance - plan_consumed

        transactions << CreditTransaction.create!(
          account: @account,
          transaction_type: "consume",
          credit_type: "plan",
          reason: reason,
          amount: -plan_consumed,
          balance_after: new_total,
          plan_balance_after: new_plan,
          pack_balance_after: pack_balance,
          reference_type: reference_type,
          reference_id: reference_id,
          metadata: metadata
        )

        total_balance = new_total
        plan_balance = new_plan
      end

      # Step 2: Consume from pack credits (if positive and still need more)
      if pack_balance > 0 && remaining > 0
        pack_consumed = [remaining, pack_balance].min  # NEVER exceed pack balance
        remaining -= pack_consumed

        new_pack = pack_balance - pack_consumed
        new_total = total_balance - pack_consumed

        transactions << CreditTransaction.create!(
          account: @account,
          transaction_type: "consume",
          credit_type: "pack",
          reason: reason,
          amount: -pack_consumed,
          balance_after: new_total,
          plan_balance_after: plan_balance,
          pack_balance_after: new_pack,
          reference_type: reference_type,
          reference_id: reference_id,
          metadata: metadata
        )

        total_balance = new_total
        pack_balance = new_pack
      end

      # Step 3: If still remaining, plan goes negative (pack NEVER goes negative)
      if remaining > 0
        new_plan = plan_balance - remaining  # plan goes negative
        new_total = total_balance - remaining

        transactions << CreditTransaction.create!(
          account: @account,
          transaction_type: "consume",
          credit_type: "plan",
          reason: reason,
          amount: -remaining,
          balance_after: new_total,
          plan_balance_after: new_plan,  # negative!
          pack_balance_after: pack_balance,  # stays at 0, NEVER negative
          reference_type: reference_type,
          reference_id: reference_id,
          metadata: metadata.merge(debt: true)
        )
      end

      invalidate_balance_cache!
    end

    transactions
  end

  private

  def invalidate_balance_cache!
    Rails.cache.delete("credit_balance:#{@account.id}")
  end
end
```

### Integration with Langgraph

```ruby
# Credits::ChargeRunWorker - called after llm_usage are written to Postgres
module Credits
  class ChargeRunWorker
    include Sidekiq::Worker
    sidekiq_options queue: :billing

    def perform(run_id)
      # Idempotent: skip if already processed
      return if LlmUsage.where(run_id: run_id).where.not(processed_at: nil).exists?

      records = LlmUsage.where(run_id: run_id, processed_at: nil)
      return if records.empty?

      # Aggregate usage for this run
      run_summary = records.select(
        "MIN(chat_id) as chat_id",
        "MIN(graph_name) as graph_name",
        "SUM(cost_usd) as total_cost_usd",
        "COUNT(*) as llm_call_count"
      ).first

      chat = Chat.find(run_summary.chat_id)
      account = chat.project.account
      credits = calculate_credits(run_summary.total_cost_usd)

      ApplicationRecord.transaction do
        CreditConsumptionService.new(account).consume!(
          amount: credits,
          reason: "ai_generation",
          reference_type: "llm_run",
          reference_id: run_id,
          metadata: {
            graph: run_summary.graph_name,
            llm_call_count: run_summary.llm_call_count,
            cost_usd: run_summary.total_cost_usd.to_f
          }
        )

        # Mark all records for this run as processed
        records.update_all(processed_at: Time.current)
      end
    end

    private

    def calculate_credits(cost_usd)
      # $0.01 = 1 credit
      (cost_usd * 100).ceil
    end
  end
end
```

### Monthly Plan Allocation (Renewal)

```ruby
module Credits
  class ResetPlanCreditsWorker
    include Sidekiq::Worker
    sidekiq_options queue: :credits

    def perform(account_id, options = {})
      idempotency_key = options["idempotency_key"]

      # Skip if already processed (idempotency)
      return if idempotency_key && CreditTransaction.exists?(idempotency_key: idempotency_key)

      account = Account.find(account_id)
      plan_tier = account.plan&.plan_tier
      return unless plan_tier

      Account.transaction do
        account.lock!

        # Get current state
        current = account.credit_transactions
          .order(created_at: :desc)
          .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]

        current_total, current_plan, current_pack = current

        # Forfeit unused plan credits, keep pack credits
        # If plan is negative, debt carries over into new plan allocation
        debt = [current_plan, 0].min.abs  # e.g., if plan is -50, debt is 50

        new_plan_credits = plan_tier.credits  # from PlanTier.details[:credits]
        new_plan = new_plan_credits - debt    # debt absorbed by new allocation
        new_pack = current_pack               # pack unchanged (already at 0 or positive)
        new_total = new_plan + new_pack

        CreditTransaction.create!(
          account: account,
          transaction_type: "allocate",
          credit_type: "plan",
          reason: "plan_renewal",
          amount: new_plan_credits,
          balance_after: new_total,
          plan_balance_after: new_plan,
          pack_balance_after: new_pack,
          reference_type: "Pay::Subscription",
          reference_id: account.payment_processor&.subscription&.id&.to_s,
          idempotency_key: idempotency_key,
          metadata: {
            plan_tier: plan_tier.name,
            credits_allocated: new_plan_credits,
            debt_absorbed: debt,
            plan_credits_forfeited: [current_plan, 0].max
          }
        )

        Rails.cache.delete("credit_balance:#{account.id}")
      end
    end
  end
end
```

---

## Decisions Made

1. **Credit expiration**: Packs don't expire (for now). `expires_at` column exists for future use (gifted packs).

2. **Rollover**: Plan credits do NOT roll over. Unused plan credits are forfeited at renewal.

3. **Negative balance**: ALLOWED. Pre-run check in Langgraph gates at 100% usage, but if a run goes over, we allow negative balance. Debt is absorbed by next month's plan allocation.

4. **Refunds**: PUNITIVE - deducts credits when customer refunds after using (we incurred the cost).

5. **Multi-seat accounts**: Credits shared at account level.

6. **Transaction granularity**: Batched at the graph run level (one transaction per run, linked via `run_id`). See [langgraph_integration.md](./langgraph_integration.md).

7. **Plan renewal timing**: Forfeit unused plan credits, keep pack credits, absorb any debt from new allocation.

## Open Questions

All open questions have been resolved. See [credit-packs.md](./credit-packs.md#resolved-decisions-qa-summary) for the full Q&A summary.

---

## Next Steps

### Rails App

1. Create migration for `credit_transactions` table (with 3 balance columns)
2. Create migration for `credit_packs` table
3. Create migration for `llm_usage` table (see langgraph_integration.md) - NO `llm_runs` table needed
4. Build `CreditTransaction` model with validations and scopes
5. Build `CreditPack` model with purchase logic
6. Build `CreditBalance` query class with synchronous cache invalidation
7. Build `CreditConsumptionService` with FIFO and proper negative balance handling
8. Build `Credits::ChargeRunWorker` to charge after run completes
9. Build `Credits::ResetPlanCreditsWorker` for plan credit allocation/renewal
10. Build `Credits::FindUnprocessedRunsWorker` as backup polling
11. Build `POST /api/v1/llm_usage/notify` endpoint for Langgraph to trigger charging
12. Hook allocation worker into subscription renewal (Pay gem callback via PaySubscriptionCredits concern)
13. Build 90% threshold alert system
14. Add billing/usage page to show breakdown

### Langgraph App

15. Implement usage tracking callbacks (see langgraph_integration.md)
16. Implement pre-graph hook for credit balance check (`GET /api/v1/credits/balance`)
17. Add `usagePercentage` to CoreGraphState
18. Support `testCredits` config flag to skip credit checks in non-prod
19. Call `POST /api/v1/llm_usage/notify` after graph completes
