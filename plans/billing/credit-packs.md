# Credit Packs & Centralized Credits System

## Overview

Implement a centralized credits system that:

1. Grants **monthly plan credits** on billing cycle (reset each period, don't rollover)
2. Supports **one-off credit pack purchases** (rollover indefinitely until used)
3. Shows users a single unified "credits remaining" number
4. Handles plan upgrades/downgrades appropriately
5. Bills credit usage after each AI agent run
6. Uses an append-only transaction history to track credit usage
7. Supports fast-queryable credit balance lookups

## Architecture Decisions

| Decision                 | Choice                                                                 | Rationale                                                      |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Credit storage           | Transaction ledger with denormalized running balances per row (`balance_after`, `plan_balance_after`, `pack_balance_after`) | Most recent transaction IS the current state. No columns on Account. |
| Credits source           | `PlanTier.details[:credits]` | Already implemented. Do not use TierLimit or PlanLimit. |
| Billing cycle detection  | `after_commit` callbacks on `Pay::Subscription` + daily safety net job | Pay handles webhook complexity; we just react to model changes |
| Credit consumption order | Plan credits first, then pack credits, then plan goes negative | Plan credits expire; pack credits NEVER go negative |
| Negative balance         | Plan credits can go negative; pack credits NEVER negative | Debt absorbed from next month's plan allocation |
| Upgrade handling         | Grant prorated additional credits immediately                          | User paid for them                                             |
| Downgrade handling       | Keep current credits until next cycle                                  | Better UX, Stripe prorates payment                             |
| Cache strategy           | Synchronous invalidation on write (not TTL-based)                      | Accurate balances during rapid usage                           |

## Pay::Subscription Callbacks

We allocate credits using ActiveRecord `after_commit` callbacks on `Pay::Subscription`. This is the cleanest approach because:

1. **Pay handles all webhook complexity** - We don't touch webhooks, controllers, or Stripe events directly
2. **Standard Rails patterns** - Just `after_commit` callbacks with `saved_change_to_*` detection
3. **Reliable** - Callbacks fire after the transaction commits, so we know the data is persisted
4. **Testable** - Easy to test by creating/updating `Pay::Subscription` records directly

### Why This Works

Pay gem internally processes Stripe webhooks and calls `update!` on the subscription record. When that happens, our `after_commit` callbacks fire automatically. We never interact with webhooks - we just react to model changes.

**Key fields Pay updates**: `current_period_start`, `current_period_end`, `status`, `processor_plan` - exactly what we need to detect lifecycle events.

### Subscription Lifecycle Matrix

> **Naming Convention**: All credit-related Sidekiq workers use the `Credits::` namespace with a `Worker` suffix.

| Event                           | Callback                   | Detection                               | Action                                             | Sidekiq Worker                    |
| ------------------------------- | -------------------------- | --------------------------------------- | -------------------------------------------------- | --------------------------------- |
| **New subscription (active)**   | `after_commit on: :create` | `active?`                               | Zero out old (expire) + allocate new plan credits  | `Credits::ResetPlanCreditsWorker` |
| **New subscription (trialing)** | `after_commit on: :create` | `trialing?`                             | Zero out old (expire) + allocate new plan credits  | `Credits::ResetPlanCreditsWorker` |
| **Trial → Paid**                | `after_commit on: :update` | status `trialing→active`                | No action (already allocated)                      | —                                 |
| **Renewal (monthly sub)**       | `after_commit on: :update` | `current_period_end` ↑ (not from trial) | Zero out old (expire) + allocate new plan credits  | `Credits::ResetPlanCreditsWorker` |
| **Monthly reset (yearly sub)**  | `DailyReconciliationJob`   | No reset transaction in last month      | Zero out old (expire) + allocate new plan credits  | `Credits::ResetPlanCreditsWorker` |
| **Upgrade**                     | `after_commit on: :update` | `processor_plan` changed + credits ↑    | Zero out old (expire) + allocate new (higher) plan | `Credits::ResetPlanCreditsWorker` |
| **Downgrade**                   | `after_commit on: :update` | `processor_plan` changed + credits ↓    | Zero out old + allocate new (lower) plan           | `Credits::ResetPlanCreditsWorker` |
| **Cancel scheduled**            | `after_commit on: :update` | `ends_at` set                           | No action                                          | —                                 |
| **Subscription ended**          | `after_commit on: :update` | status → `canceled`                     | Zero out plan credits (keep purchased)             | `Credits::ResetPlanCreditsWorker` |
| **Reactivation**                | `after_commit on: :update` | `ends_at` cleared                       | No action                                          | —                                 |
| **Pause**                       | `after_commit on: :update` | status → `paused`                       | No action                                          | —                                 |
| **Resume**                      | `after_commit on: :update` | status `paused→active`                  | No action                                          | —                                 |
| **Payment failed**              | `after_commit on: :update` | status → `past_due`                     | No action                                          | —                                 |
| **Payment recovered**           | `after_commit on: :update` | status `past_due→active`                | No action                                          | —                                 |

### Worker Architecture: Three Workers

We use exactly **three workers** for all credit operations:

1. **`Credits::ResetPlanCreditsWorker`** - Idempotent worker that syncs plan credits to current subscription state
2. **`Credits::ChargeRunWorker`** - Processes a completed graph run and charges credits
3. **`Credits::FindUnprocessedRunsWorker`** - Backup polling to catch missed notifications

#### Credits::ResetPlanCreditsWorker

This worker is the workhorse for plan credit allocation. It handles ALL plan credit changes by following a simple pattern:

```
1. Zero out any existing plan credits (creates expire transaction if balance > 0)
2. Allocate new plan credits based on current subscription state (from PlanTier.details[:credits])
```

**Why this works for everything:**

- **New subscription**: No existing credits → just allocate new
- **Renewal**: Zero out remaining → allocate fresh monthly amount
- **Upgrade**: Zero out old plan credits → allocate new (higher) amount
- **Downgrade**: Zero out old plan credits → allocate new (lower) amount
- **Cancellation**: Zero out plan credits → allocate nothing (pack credits remain)

**Key insight**: The worker doesn't need to know WHY it was called. It simply looks at the current subscription state and makes the credits match. This makes it idempotent and safe to retry.

#### Credits::ChargeRunWorker

Processes a specific `run_id` after Langgraph notifies Rails. Aggregates `cost_usd` from `llm_usage` and creates a `CreditTransaction`.

```ruby
# Called via POST /api/v1/llm_usage/notify from Langgraph
Credits::ChargeRunWorker.perform_async(run_id)
```

**Consumption order (FIFO):**
1. Consume plan credits (if positive)
2. Consume pack credits (if positive and still need more)
3. Plan credits go negative (pack credits NEVER go negative)

#### Credits::FindUnprocessedRunsWorker

Backup polling job (runs every minute). Catches any runs where the API notification failed.

```ruby
# Scheduled via Zhong/Sidekiq-Cron
Credits::FindUnprocessedRunsWorker.perform_async
```

**Why Sidekiq workers?**

- Credit operations should be idempotent and retriable
- Failure shouldn't break the callback chain
- Workers receive `subscription_id` + `idempotency_key` to ensure exactly-once semantics
- Keeps callbacks fast - just enqueue and return

### Monthly Resets for Yearly Subscribers

Yearly subscriptions only trigger Stripe events once per year, but credits reset monthly. We handle this with a **daily batch job**:

```
DailyReconciliationJob (runs daily)
    ↓
Query: "Which accounts need monthly reset?"
    - Active yearly subscription
    - No CreditTransaction(type: allocate, reason: plan_renewal) in last month
    ↓
Enqueue Credits::ResetPlanCreditsWorker for each account
    ↓
Worker retries until success → creates CreditTransaction
    ↓
Next day's query won't pick up this account (transaction exists)
```

**Key insight**: The `CreditTransaction` record is the success marker. No extra columns on Account needed - we query the append-only transaction log to determine what's due.

```ruby
# Find yearly subscribers needing monthly reset
Account.joins(:subscriptions)
  .where(subscriptions: { status: "active", interval: "year" })
  .where.not(
    id: CreditTransaction
      .where(transaction_type: "allocate", reason: "plan_renewal")
      .where("created_at > ?", 1.month.ago)
      .select(:account_id)
  )
  .find_in_batches do |batch|
    batch.each do |account|
      Credits::ResetPlanCreditsWorker.perform_async(
        account.id,
        { idempotency_key: "plan_renewal:#{account.id}:#{Time.current.beginning_of_month.to_i}" }
      )
    end
  end
```

**Blocking at consumption (not allocation):**

- `paused`, `past_due`, `canceled` statuses don't revoke credits
- Instead, check `subscription.active?` when deducting credits in Langgraph
- This avoids complex state management and race conditions

### Detection Patterns

```ruby
# In PaySubscriptionCredits concern (included in Pay::Subscription)

# Status transitions
saved_change_to_status?
saved_changes["status"] == ["trialing", "active"]  # trial → paid
saved_changes["status"][1] == "canceled"           # ended
saved_changes["status"][1] == "past_due"           # payment failed

# Plan changes
saved_change_to_processor_plan?
old_plan = Plan.find_by(stripe_id: saved_changes["processor_plan"][0])
new_plan = Plan.find_by(stripe_id: saved_changes["processor_plan"][1])
upgrade = new_plan.credits > old_plan.credits

# Renewal (period end moved forward, not from trial conversion)
saved_change_to_current_period_end? &&
  saved_changes["current_period_end"][1] > saved_changes["current_period_end"][0] &&
  saved_changes["status"]&.first != "trialing"

# Cancellation scheduled vs ended
saved_change_to_ends_at?              # cancel scheduled
ends_at_previously_was.present?       # reactivation (ends_at cleared)
```

### Idempotency Keys

| Event            | Key Format                                                      |
| ---------------- | --------------------------------------------------------------- |
| New subscription | `reset_credits:{subscription_id}:{current_period_start}`        |
| Renewal          | `reset_credits:{subscription_id}:{current_period_start}`        |
| Plan change      | `reset_credits:{subscription_id}:{processor_plan}:{updated_at}` |
| Monthly (yearly) | `reset_credits:{account_id}:monthly:{beginning_of_month}`       |
| Cancellation     | `reset_credits:{subscription_id}:canceled:{updated_at}`         |
| Debit            | `debit:{account_id}:{reason}:{reference_type}:{reference_id}`   |

## Data Model

> **No Account Columns**: Balance is derived entirely from the CreditTransaction ledger. Each transaction stores running balances (`balance_after`, `plan_balance_after`, `pack_balance_after`). The most recent transaction IS the current state.

### 1. CreditTransaction Model (Source of Truth + Audit Log)

```ruby
# Table: credit_transactions
create_table :credit_transactions do |t|
  t.references :account, null: false, foreign_key: true

  # Transaction classification
  t.string :transaction_type, null: false  # allocate, consume, purchase, refund, adjust
  t.string :credit_type, null: false       # plan, pack
  t.string :reason, null: false            # plan_renewal, pack_purchase, ai_generation, support_credit, refund

  # Amount and running balances (denormalized per row - this IS the source of truth)
  t.bigint :amount, null: false            # positive=credit, negative=debit
  t.bigint :balance_after, null: false     # total balance after this transaction
  t.bigint :plan_balance_after, null: false  # plan credits remaining
  t.bigint :pack_balance_after, null: false  # pack credits remaining

  # Reference to source record (string-based, not polymorphic AR)
  # For LLM usage: reference_type = "llm_run", reference_id = run_id UUID
  t.string :reference_type                 # "llm_run", "CreditPack", "Pay::Subscription", etc.
  t.string :reference_id

  t.jsonb :metadata, default: {}
  t.string :idempotency_key

  t.timestamps

  t.index [:account_id, :created_at]
  t.index [:reference_type, :reference_id]
  t.index :idempotency_key, unique: true, where: "idempotency_key IS NOT NULL"
end
```

**Example transaction flow:**

```
date         | reason         | type     | credit_type | amount | balance_after | plan_balance | pack_balance
-------------|----------------|----------|-------------|--------|---------------|--------------|-------------
2025-10-01   | plan_renewal   | allocate | plan        | +500   | 500           | 500          | 0
2025-10-01   | ai_generation  | consume  | plan        | -10    | 490           | 490          | 0
2025-11-01   | plan_renewal   | allocate | plan        | +500   | 500           | 500          | 0  (old forfeited)
2025-11-01   | pack_purchase  | purchase | pack        | +500   | 1000          | 500          | 500
2025-11-02   | ai_generation  | consume  | plan        | -510   | 490           | 0            | 490  (split: -500 plan, -10 pack)
2025-11-03   | ai_generation  | consume  | pack        | -600   | -110          | -110         | 0  (pack depleted, plan goes negative)
2025-12-01   | plan_renewal   | allocate | plan        | +500   | 390           | 390          | 0  (debt absorbed: 500-110=390)
```

**Key rules:**
- Plan credits consumed first (FIFO)
- Pack credits consumed when plan is at 0
- When pack is also at 0, plan goes negative (debt absorbed next month)
- Pack credits can NEVER go negative

**Design: Ledger-Only Source of Truth**

- **Transaction log is authoritative** - `balance_after`, `plan_balance_after`, `pack_balance_after` are the source of truth
- **No columns on Account** - Balance derived from most recent transaction
- **Cached for reads** - `CreditBalance` class caches the most recent transaction's balances
- **Synchronous invalidation** - Cache invalidated immediately on every write (not TTL-based)

**Linking to Langgraph Messages:**

Messages are stored as JSONB blobs in Langgraph's `checkpoints` table (not individual rows). The linkage chain:

```
checkpoints.thread_id → Chat.thread_id → Project → Account
```

For credit transactions, use:

- **`reference_type: "Chat"`** - Links to the conversation (Rails model)
- **`metadata` JSONB** - Stores granular details:
  - `run_id`: Langgraph run ID for specific execution
  - `graph`: Which graph (brainstorm, website, ads)
  - `message_count`: Messages in this charge (for batched billing)
  - `checkpoint_id`: Optional, for audit drill-down

Example transaction for AI generation:

```ruby
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -10,
  balance_after: 490,
  reference: chat,  # Chat model has thread_id linking to Langgraph
  metadata: { run_id: "abc123", graph: "brainstorm", message_count: 1 }
)
```

### 2. Plan Credits Source (Already Implemented)

Credits come from `PlanTier.details[:credits]`. This is already implemented - do NOT use `TierLimit` or `PlanLimit`.

```ruby
# PlanTier model (already exists)
class PlanTier < ApplicationRecord
  store_accessor :details, :features, :credits

  def credits
    super.to_i
  end
end

# Usage
plan_tier = account.plan&.plan_tier
monthly_credits = plan_tier.credits  # e.g., 2000, 5000, 15000
```

## Credit Deduction Architecture

**Deduction happens in Langgraph at execution time** - more accurate billing, only charges for successful generations.

**Existing Pattern**: Langgraph already calls Rails via typed API services (`BrainstormAPIService`, `CampaignAPIService`, etc.) using JWT + HMAC authentication.

**New Flow:**

```
User sends message → Rails → Langgraph
                              ↓
                         AI executes
                              ↓
                    AccountCreditsAPIService.deductCredits()
                              ↓
                         Rails API
                              ↓
                    CreditTransaction created
                              ↓
                    Response to Langgraph
```

**New Files (Langgraph side):**

- `shared/lib/api/services/accountCreditsAPIService.ts` - API client for credits

**New Files (Rails side):**

- `app/controllers/api/v1/account_credits_controller.rb` - Deduction endpoint
- Update OpenAPI schema generation

## Credit Packs

Credit packs are one-time purchases that grant credits which rollover indefinitely until used. Unlike plan credits (which reset monthly), purchased credits persist across billing cycles.

### Pricing

| Pack  | Credits | Price | $/credit | Our Cost | Margin |
| ----- | ------- | ----- | -------- | -------- | ------ |
| Small | 500     | $25   | $0.05    | $5       | 80%    |
| Mid   | 1,250   | $50   | $0.04    | $12.50   | 75%    |
| Big   | 3,000   | $100  | $0.033   | $30      | 70%    |

**What users get (in terms of page generations @ 50 credits each):**

- Small Pack: ~10 pages
- Mid Pack: ~25 pages
- Big Pack: ~60 pages

### Data Model

```ruby
# Table: credit_packs
create_table :credit_packs do |t|
  t.string :name, null: false           # "Small", "Mid", "Big"
  t.integer :credits, null: false       # 500, 1250, 3000
  t.integer :amount, null: false        # cents (2500, 5000, 10000)
  t.string :currency, default: 'usd'
  t.string :stripe_price_id             # Links to Stripe Price
  t.boolean :visible, default: true     # Show in UI
  t.timestamps
end
```

### Stripe Setup

Credit packs are Stripe Products with one-time Prices (not recurring subscriptions).

**1. Create Products in Stripe Dashboard:**

- Product: "Small Credit Pack" → Price: $25 (one-time)
- Product: "Mid Credit Pack" → Price: $50 (one-time)
- Product: "Big Credit Pack" → Price: $100 (one-time)

**2. Add Price IDs to Rails credentials:**

```yaml
stripe:
  credit_packs:
    small: price_xxx
    medium: price_yyy
    large: price_zzz
```

**3. Seed CreditPack records:**

```ruby
# db/seeds/credit_packs.rb
CreditPack.find_or_create_by!(name: "Small") do |pack|
  pack.credits = 500
  pack.amount = 2500
  pack.stripe_price_id = Rails.application.credentials.dig(:stripe, :credit_packs, :small)
end
# ... repeat for Mid, Big
```

### Purchase Flow

```
User visits /credit_packs
         ↓
Selects a pack (e.g., "Mid - 1,250 credits for $50")
         ↓
Controller creates Stripe Checkout Session (mode: "payment")
  - line_items: [{ price: pack.stripe_price_id, quantity: 1 }]
  - metadata: { credit_pack_id: pack.id, account_id: account.id }
         ↓
User redirects to Stripe Checkout, completes payment
         ↓
Stripe sends checkout.session.completed webhook
         ↓
Pay gem creates Pay::Charge record
         ↓
ChargeExtensions#after_commit callback fires
         ↓
Credits::GrantPurchasedCreditsJob enqueued (idempotent)
         ↓
Job grants credits to account.purchased_credits
```

### Implementation Files

**Files to create:**

- `app/models/credit_pack.rb` - Model with validations
- `app/controllers/credit_packs_controller.rb` - Index + checkout session creation
- `app/views/credit_packs/` - Purchase UI (or React components)
- `app/jobs/credits/grant_purchased_credits_job.rb` - Idempotent credit granting

**Files to modify:**

- `config/initializers/pay.rb` - Add `ChargeExtensions` with fulfillment callback
- `config/routes.rb` - Add `/credit_packs` routes

### Pay Gem Integration

Extend `Pay::Charge` to fulfill credit pack purchases:

```ruby
# config/initializers/pay.rb
module ChargeExtensions
  extend ActiveSupport::Concern

  included do
    after_commit :fulfill_credit_pack_purchase, on: :create
  end

  private

  def fulfill_credit_pack_purchase
    return unless data&.dig("metadata", "credit_pack_id")

    Credits::GrantPurchasedCreditsJob.perform_later(
      charge_id: id,
      idempotency_key: "credit_pack_purchase:#{id}"
    )
  end
end

Rails.application.config.to_prepare do
  Pay::Charge.include ChargeExtensions
end
```

### Controller Example

```ruby
# app/controllers/credit_packs_controller.rb
class CreditPacksController < ApplicationController
  def index
    @credit_packs = CreditPack.visible.order(:amount)
  end

  def checkout
    pack = CreditPack.visible.find(params[:id])

    session = Stripe::Checkout::Session.create(
      customer: current_account.payment_processor.processor_id,
      mode: "payment",
      line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
      metadata: {
        credit_pack_id: pack.id,
        account_id: current_account.id
      },
      success_url: credit_packs_url(purchased: true),
      cancel_url: credit_packs_url
    )

    redirect_to session.url, allow_other_host: true
  end
end
```

## Implementation Phases

### Phase 1: Database & Models

**Files to create:**

- `db/migrate/XXXX_create_credit_packs.rb`
- `db/migrate/XXXX_create_credit_transactions.rb`
- `db/migrate/XXXX_create_llm_usage.rb`
- `app/models/credit_pack.rb`
- `app/models/credit_transaction.rb`
- `app/models/llm_usage_record.rb`
- `app/services/credit_balance.rb`
- `app/services/credit_consumption_service.rb`
- `app/services/credit_allocation_service.rb`

**No Account columns migration** - Balance is derived from the ledger.

**Files to modify:**

- `spec/snapshot_builders/core/plans.rb` - Add `credits` to PlanTier.details

### Phase 2: Credit Operations

**CreditBalance** (`app/services/credit_balance.rb`):

- `CreditBalance.for(account).total` - Total credits (plan + pack)
- `CreditBalance.for(account).plan` - Plan credits only
- `CreditBalance.for(account).pack` - Pack credits only
- `CreditBalance.for(account).breakdown` - Returns `{ total:, plan:, pack: }`
- `CreditBalance.for(account).usage_percentage` - Percentage of plan credits used
- `CreditBalance.for(account).invalidate!` - Clear cache (called synchronously on writes)

**CreditConsumptionService** (`app/services/credit_consumption_service.rb`):

- `consume!(amount:, reference_id:, reference_type:, metadata:)` - FIFO consumption with proper negative balance handling

**CreditAllocationService** (`app/services/credit_allocation_service.rb`):

- `allocate_plan_credits!(billing_period:)` - Monthly plan credit allocation
- `add_pack_credits!(credit_pack:)` - Credit pack purchase
- `adjust!(amount:, reason:, metadata:)` - Manual adjustments (support credits)

**Note:** All credit operations use database locking (`with_lock`) for atomic operations (follows `AccountRequestCount` pattern).

### Phase 3: Credit Packs

See the [Credit Packs](#credit-packs) section above for complete details on:

- Data model and Stripe setup
- Purchase flow via Stripe Checkout
- Pay gem integration for fulfillment
- Implementation files and controller examples

### Phase 4: Billing Cycle Credit Refresh

**Files to create:**

- `app/workers/credits/reset_plan_credits_worker.rb` - Idempotent worker: zeros out subscription allocations, creates new allocations
- `app/workers/credits/charge_run_worker.rb` - Processes LLM run and creates credit transactions
- `app/workers/credits/find_unprocessed_runs_worker.rb` - Backup polling for missed notifications
- `app/jobs/credits/daily_reconciliation_job.rb` - Batch job for monthly resets (yearly subs) + catch-up
- `app/models/concerns/pay_subscription_credits.rb` - Concern with `after_commit` hooks

**Files to modify:**

- `config/initializers/pay.rb`:
  - Include `PaySubscriptionCredits` concern in `Pay::Subscription`
- `schedule.rb` - Add daily reconciliation job + minute-level backup polling

**Two trigger mechanisms:**

1. **Callbacks** (immediate) - For events Pay knows about:
   - `Pay::Subscription` created/updated → `after_commit` fires → enqueue `Credits::ResetPlanCreditsWorker`

2. **Daily batch job** (scheduled) - For events with no Stripe trigger:
   - Query `CreditTransaction` log to find accounts needing monthly reset
   - Handles yearly subscribers (monthly reset, no Stripe event)
   - Also catches edge cases (e.g., subscription created via Stripe Dashboard)

**PaySubscriptionCredits Concern:**

```ruby
# app/models/concerns/pay_subscription_credits.rb
module PaySubscriptionCredits
  extend ActiveSupport::Concern

  included do
    after_commit :handle_subscription_created, on: :create
    after_commit :handle_subscription_updated, on: :update
  end

  private

  def handle_subscription_created
    return unless active? || trialing?

    Credits::ResetPlanCreditsWorker.perform_async(
      customer.owner_id,
      { idempotency_key: "plan_renewal:#{id}:#{current_period_start.to_i}" }
    )
  end

  def handle_subscription_updated
    # All these events trigger the same worker - it's idempotent and figures out
    # what to do based on current subscription state
    if needs_credit_reset?
      Credits::ResetPlanCreditsWorker.perform_async(
        customer.owner_id,
        { idempotency_key: idempotency_key_for_reset }
      )
    end
  end

  def needs_credit_reset?
    renewal? || plan_changed? || canceled?
  end

  def renewal?
    saved_change_to_current_period_end? &&
      current_period_end > current_period_end_before_last_save &&
      !trial_conversion?
  end

  def trial_conversion?
    saved_changes.dig("status", 0) == "trialing"
  end

  def plan_changed?
    saved_change_to_processor_plan?
  end

  def canceled?
    saved_change_to_status? && status == "canceled"
  end

  def idempotency_key_for_reset
    if canceled?
      "plan_renewal:#{id}:canceled:#{updated_at.to_i}"
    elsif plan_changed?
      "plan_renewal:#{id}:#{processor_plan}:#{updated_at.to_i}"
    else
      "plan_renewal:#{id}:#{current_period_start.to_i}"
    end
  end
end
```

**ResetPlanCreditsWorker Implementation:**

```ruby
# app/workers/credits/reset_plan_credits_worker.rb
module Credits
  class ResetPlanCreditsWorker
    include Sidekiq::Worker
    sidekiq_options queue: :credits

    def perform(account_id, options = {})
      idempotency_key = options["idempotency_key"]

      # Skip if already processed (idempotency)
      return if idempotency_key && CreditTransaction.exists?(idempotency_key: idempotency_key)

      account = Account.find(account_id)
      subscription = account.payment_processor&.subscription

      CreditAllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key
      )
    end
  end
end
```

**Note:** The actual credit logic is in `CreditAllocationService` which:
1. Zeros out any existing plan credits (creates expire transaction if balance > 0)
2. Allocates new plan credits based on current subscription state (from `PlanTier.details[:credits]`)
3. Handles negative balance debt absorption

**ChargeRunWorker Implementation:**

Credit consumption is handled by `Credits::ChargeRunWorker` which processes completed graph runs. See [langgraph_integration.md](./langgraph_integration.md) for the full implementation.

```ruby
# app/workers/credits/charge_run_worker.rb
module Credits
  class ChargeRunWorker
    include Sidekiq::Worker
    sidekiq_options queue: :billing

    def perform(run_id)
      # Idempotent: skip if already processed
      return if LlmUsage.where(run_id: run_id).where.not(processed_at: nil).exists?

      records = LlmUsage.where(run_id: run_id, processed_at: nil)
      return if records.empty?

      # Aggregate and charge via CreditConsumptionService
      # See langgraph_integration.md for full implementation
    end
  end
end
```

**Credit consumption order (FIFO):**
1. Consume from plan credits first (if positive)
2. Consume from pack credits (if positive and still need more)
3. If still remaining, plan goes negative (pack NEVER goes negative)

### Phase 5: Langgraph Credit Deduction

**Files to create (shared):**

- `shared/lib/api/services/accountCreditsAPIService.ts`

**Files to modify (Langgraph):**

- `langgraph_app/app/nodes/` - Add credit deduction calls to AI execution nodes
- `shared/lib/api/services/index.ts` - Export new service

**Files to modify (Rails):**

- `app/controllers/api/v1/account_credits_controller.rb` - Add `deduct` action
- Regenerate OpenAPI schema

**Deduction Points in Langgraph:**

- Brainstorm graph: After successful AI response
- Website graph: After page generation
- Ads graph: After ad copy generation

**API Endpoint:**

```
POST /api/v1/account_credits/deduct
{
  "amount": 10,
  "reason": "ai_generation",
  "chat_id": "chat_abc123",
  "metadata": { "graph": "brainstorm", "run_id": "xyz" }
}
```

Rails controller enqueues `DebitCreditsJob` with idempotency key and returns immediately:

```ruby
# app/controllers/api/v1/account_credits_controller.rb
def deduct
  Credits::DebitCreditsJob.perform_later(
    account_id: current_account.id,
    amount: params[:amount],
    reason: params[:reason],
    reference_type: "Chat",
    reference_id: params[:chat_id],
    metadata: params[:metadata] || {},
    idempotency_key: "debit:#{current_account.id}:#{params[:reason]}:Chat:#{params[:chat_id]}"
  )

  render json: {
    success: true,
    balance: {
      total: current_account.total_credits,
      plan: current_account.plan_credits,
      purchased: current_account.purchased_credits
    }
  }
end
```

**Response:**

```json
{
  "success": true,
  "balance": { "total": 490, "plan": 490, "purchased": 0 }
}
```

### Phase 6: Frontend Integration

**Files to create:**

- `app/controllers/api/v1/credits_controller.rb` - Read-only balance/history
- React components for credit display and purchase UI

**API Endpoints:**

- `GET /api/v1/credits` - Returns balance breakdown
- `GET /api/v1/credits/transactions` - Returns transaction history

## Critical Files Reference

| File                                                    | Purpose                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `rails_app/config/initializers/pay.rb`                  | Extend Pay::Charge and Pay::Subscription |
| `rails_app/app/models/account.rb`                       | Add Credits concern                      |
| `rails_app/app/models/account_request_count.rb`         | Pattern for `with_lock` atomic ops       |
| `rails_app/app/controllers/subscriptions_controller.rb` | Pattern for Stripe Checkout              |
| `rails_app/spec/snapshot_builders/core/plans.rb`        | Seed plan limits                         |
| `rails_app/app/workers/credits/reset_plan_credits_worker.rb`  | Handles all plan credit allocations      |
| `rails_app/app/workers/credits/charge_run_worker.rb`          | Handles credit consumption for LLM runs  |
| `rails_app/app/workers/credits/find_unprocessed_runs_worker.rb` | Backup polling for missed notifications |
| `shared/lib/api/railsApiBase.ts`                        | Base class for API services              |
| `shared/lib/api/services/`                              | Existing API service patterns            |
| `langgraph_app/app/nodes/core/`                         | Node patterns for credit deduction       |

## Verification Plan

### Unit Tests

- `CreditPack` model validations and scopes
- `CreditTransaction` creation and audit trail
- `ResetPlanCreditsJob` - idempotency, zeros out old credits, allocates new
- `DebitCreditsJob` - idempotency, plan-first consumption, insufficient credits handling

### Integration Tests

- Credit pack purchase flow end-to-end
- New subscription triggers `ResetPlanCreditsJob` → allocates credits
- Plan upgrade triggers `ResetPlanCreditsJob` → zeros old + allocates new (higher) amount
- Plan downgrade triggers `ResetPlanCreditsJob` → zeros old + allocates new (lower) amount
- Billing cycle renewal triggers `ResetPlanCreditsJob` → resets credits
- Subscription cancellation triggers `ResetPlanCreditsJob` → zeros plan credits (purchased remain)
- Purchased credits persist across billing cycles

### Manual Testing

1. Create test credit packs in Stripe Dashboard
2. Purchase a credit pack, verify credits added
3. Use credits, verify deduction order (plan first)
4. Wait for/simulate billing cycle, verify plan credits reset
5. Upgrade plan mid-cycle, verify prorated credit grant

## Confirmed Requirements

- **Credits are for AI generations only** - Page views/traffic continue to use existing `requests_per_month` limits
- **Plan credits consumed first** - Since they expire at billing cycle, use them before purchased credits
- **Two parallel systems**: Credits (AI) + Request Limits (traffic) coexist
- **1 credit = $0.01 (1 cent) of AI spend** - Credits are directly tied to actual AI costs

## Credit Pricing Model

### Conversion Formula

```
credits_to_deduct = ai_cost_in_dollars * 100
```

### Example Costs

| AI Action                       | Typical Cost | Credits                   |
| ------------------------------- | ------------ | ------------------------- |
| Claude Sonnet message           | ~$0.01       | ~1 credit                 |
| Claude Haiku message            | ~$0.001      | ~0.1 credits (round to 1) |
| Page generation (full)          | ~$0.50       | ~50 credits               |
| Brainstorm session (5 messages) | ~$0.05       | ~5 credits                |

### Final Pricing Model

**Yearly Subscriptions (monthly credits, don't rollover):**
| Plan | Credits/mo | Price/yr | $/credit | Our Cost | Margin |
|------|------------|----------|----------|----------|--------|
| Starter | 2,000 | $59 | $0.0295 | $20 | 66% |
| Growth | 5,000 | $119 | $0.0238 | $50 | 58% |
| Pro | 15,000 | $299 | $0.0199 | $150 | 50% |

**Monthly Subscriptions (monthly credits, don't rollover):**
| Plan | Credits/mo | Price/mo | $/credit | Our Cost | Margin |
|------|------------|----------|----------|----------|--------|
| Starter | 2,000 | $79 | $0.0395 | $20 | 75% |
| Growth | 5,000 | $149 | $0.0298 | $50 | 66% |
| Pro | 15,000 | $399 | $0.0266 | $150 | 62% |

**What users get (in terms of page generations @ 50 credits each):**

- Starter: ~40 pages/month
- Growth: ~100 pages/month
- Pro: ~300 pages/month

> **Credit Packs**: See the [Credit Packs](#credit-packs) section for one-time purchase pricing and details.

### Implementation: Cost Tracking in Langgraph

**IMPORTANT**: The final AIMessage does NOT contain cumulative costs. Each AIMessage only contains usage for that specific LLM call. You must sum across ALL AIMessages.

| Question                            | Answer                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Does final message have total cost? | **No** - only that LLM call's usage                                     |
| Where is usage stored?              | Each `AIMessage` has its own `usage_metadata`                           |
| Do ToolMessages have usage?         | **No** - only AIMessage has usage                                       |
| How to get total?                   | Sum `usage_metadata` across all AIMessages using `mergeUsageMetadata()` |

**Cost Aggregation Pattern:**

```typescript
import { AIMessage, isAIMessage } from "@langchain/core/messages";
import { mergeUsageMetadata, UsageMetadata } from "@langchain/core/messages";

// Sum usage across all AIMessages in an agent run
function aggregateUsage(messages: BaseMessage[]): UsageMetadata | undefined {
  const aiMessages = messages.filter(isAIMessage);
  if (aiMessages.length === 0) return undefined;

  let total = aiMessages[0].usage_metadata;
  for (let i = 1; i < aiMessages.length; i++) {
    const usage = aiMessages[i].usage_metadata;
    if (usage) {
      total = mergeUsageMetadata(total, usage);
    }
  }
  return total;
}

// Calculate cost from usage
function calculateCost(
  usage: UsageMetadata,
  pricing: { inputPricePerMillion: number; outputPricePerMillion: number }
): number {
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.outputPricePerMillion;
  return inputCost + outputCost;
}
```

**Wrapper for Agent Runs with Cost Tracking:**

```typescript
export async function withCostTracking<T extends { messages: BaseMessage[] }>(
  modelName: string,
  agentFn: () => Promise<T>
): Promise<T & { _cost: { tokens: UsageMetadata; dollars: number; llmCalls: number } }> {
  // Validate model exists in DB - throws if not configured
  const pricing = await getModelPricing(modelName);

  const result = await agentFn();

  // Sum all AIMessage usage
  const aiMessages = result.messages.filter(isAIMessage);
  const tokens = aiMessages.reduce(
    (acc, msg) => (msg.usage_metadata ? mergeUsageMetadata(acc, msg.usage_metadata) : acc),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  );

  const dollars =
    (tokens.input_tokens / 1e6) * pricing.inputPricePerMillion +
    (tokens.output_tokens / 1e6) * pricing.outputPricePerMillion;

  return {
    ...result,
    _cost: { tokens, dollars, llmCalls: aiMessages.length },
  };
}

// Usage
const { messages, _cost } = await withCostTracking("claude-sonnet-4-20250514", () =>
  agent.invoke({ messages: [new HumanMessage("Build me a landing page")] })
);

// Deduct credits (1 credit = $0.01)
const credits = Math.ceil(_cost.dollars * 100);
await creditsAPI.deductCredits({
  amount: credits,
  reason: "ai_generation",
  metadata: {
    model: "claude-sonnet-4-20250514",
    input_tokens: _cost.tokens.input_tokens,
    output_tokens: _cost.tokens.output_tokens,
    cost_usd: _cost.dollars,
    llm_calls: _cost.llmCalls,
  },
});
```

### Model Pricing Table (extend existing model_configs)

Existing `model_configs` table needs cache pricing columns:

```ruby
# Migration: add_cache_pricing_to_model_configs
add_column :model_configs, :cost_cache_write, :decimal, precision: 10, scale: 4
add_column :model_configs, :cost_cache_read, :decimal, precision: 10, scale: 4
```

**Full schema:**

```ruby
# Table: model_configs
#  id                :bigint           not null, primary key
#  model_key         :string           not null
#  cost_in           :decimal(10, 4)   # Input tokens per 1M
#  cost_out          :decimal(10, 4)   # Output tokens per 1M
#  cost_cache_write  :decimal(10, 4)   # Cache creation per 1M (NEW)
#  cost_cache_read   :decimal(10, 4)   # Cache read per 1M (NEW)
#  enabled           :boolean          default(TRUE)
#  max_usage_percent :integer          default(100)
#  model_card        :string
```

**Usage metadata from Anthropic:**

```typescript
usage_metadata: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;  // Written to cache
  cache_read_input_tokens?: number;       // Read from cache (90% cheaper!)
}
```

**Note on image/multimedia tokens:** Image tokens ARE included in `input_tokens` but are NOT broken out separately by the API. LangChain has `input_token_details.image` in types but it's never populated. For flat-rate pricing this is fine - costs are accurate. Differential image pricing would require manual estimation.

**Updated cost calculation:**

```typescript
function calculateCost(usage: UsageMetadata, pricing: ModelConfig): number {
  const inputCost = (usage.input_tokens / 1e6) * pricing.cost_in;
  const outputCost = (usage.output_tokens / 1e6) * pricing.cost_out;

  // Cache costs (if present)
  const cacheWriteCost = usage.cache_creation_input_tokens
    ? (usage.cache_creation_input_tokens / 1e6) * pricing.cost_cache_write
    : 0;
  const cacheReadCost = usage.cache_read_input_tokens
    ? (usage.cache_read_input_tokens / 1e6) * pricing.cost_cache_read
    : 0;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
```

**Anthropic pricing data (January 2025):**
| Model | Input $/1M | Output $/1M | Cache Write $/1M | Cache Read $/1M |
|-------|------------|-------------|------------------|-----------------|
| claude-sonnet-4-20250514 | $3.00 | $15.00 | $3.75 | $0.30 |
| claude-haiku-35-20241022 | $0.80 | $4.00 | $1.00 | $0.08 |
| claude-opus-4-5-20251101 | $15.00 | $75.00 | $18.75 | $1.50 |

**Schema is sufficient for Anthropic:** 4 cost columns (in, out, cache_write, cache_read) cover all Anthropic pricing. OpenAI's `reasoning_tokens` can be added later if needed.

## All Requirements Confirmed

- **1 credit = $0.01 (1 cent) of AI spend**
- **Plan credits**: Starter 2,000 | Growth 5,000 | Pro 15,000 per month
- **Credit packs**: See [Credit Packs](#credit-packs) section (Small 500 | Mid 1,250 | Big 3,000, rollover indefinitely)
- **Margins**: 50-75% on subscriptions, 70-80% on credit packs
