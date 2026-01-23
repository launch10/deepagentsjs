# CreditTransaction Data Model

## Overview

`CreditTransaction` is the single source of truth for credit balances. Every balance-changing event creates a transaction with running balance snapshots.

## Schema

```ruby
create_table :credit_transactions do |t|
  t.references :account, null: false, foreign_key: true

  # Transaction classification
  t.string :transaction_type, null: false  # allocate, consume, purchase, refund, gift
  t.string :credit_type, null: false       # plan, pack
  t.string :reason, null: false            # ai_generation, plan_renewal, pack_purchase, support_credit

  # Amount and running balances (denormalized per row)
  t.integer :amount, null: false           # positive = credit, negative = debit
  t.integer :balance_after, null: false    # total balance after this transaction
  t.integer :plan_balance_after, null: false
  t.integer :pack_balance_after, null: false

  # Reference to source record
  # Note: For LLM usage, reference_type = "llm_run" and reference_id = run_id (UUID string)
  # No LlmRun model exists - run_id is a grouping key linking llm_usage to transactions
  t.string :reference_type   # "llm_run", "CreditPack", "Pay::Subscription", etc.
  t.string :reference_id     # UUID string for runs, integer ID for models

  # Context
  t.jsonb :metadata, default: {}
  t.string :idempotency_key

  t.timestamps
end

add_index :credit_transactions, [:account_id, :created_at]
add_index :credit_transactions, [:reference_type, :reference_id]
add_index :credit_transactions, :idempotency_key, unique: true, where: "idempotency_key IS NOT NULL"
```

## Model

```ruby
class CreditTransaction < ApplicationRecord
  belongs_to :account

  # Note: reference_type/reference_id are string columns, not polymorphic associations
  # For LLM usage: reference_type = "llm_run", reference_id = UUID string
  # For purchases: reference_type = "CreditPack", reference_id = model ID as string

  # Enums
  enum :transaction_type, {
    allocate: "allocate",   # monthly plan credits
    consume: "consume",     # usage (LLM calls)
    purchase: "purchase",   # bought a credit pack
    refund: "refund",       # PUNITIVE: deducts credits when customer refunds after using
    gift: "gift"            # admin-issued gift credits
  }, prefix: true

  enum :credit_type, {
    plan: "plan",
    pack: "pack"
  }, prefix: true

  # Reasons (not an enum - more flexible)
  REASONS = %w[
    ai_generation
    plan_renewal
    pack_purchase
    gift
    refund
  ].freeze

  # Validations
  validates :transaction_type, :credit_type, :reason, presence: true
  validates :amount, presence: true, numericality: { other_than: 0 }
  validates :balance_after, :plan_balance_after, :pack_balance_after, presence: true
  validates :reason, inclusion: { in: REASONS }
  validates :idempotency_key, uniqueness: true, allow_nil: true

  # Scopes
  scope :credits, -> { where("amount > 0") }
  scope :debits, -> { where("amount < 0") }
  scope :for_period, ->(start_date, end_date) { where(created_at: start_date..end_date) }
  scope :by_reason, ->(reason) { where(reason: reason) }
  scope :for_run, ->(run_id) { where(reference_type: "llm_run", reference_id: run_id) }

  # Callbacks
  validate :balances_are_consistent
  validate :pack_balance_never_negative

  private

  def balances_are_consistent
    expected_total = plan_balance_after + pack_balance_after
    if balance_after != expected_total
      errors.add(:balance_after, "must equal plan_balance_after + pack_balance_after")
    end
  end

  def pack_balance_never_negative
    if pack_balance_after.present? && pack_balance_after < 0
      errors.add(:pack_balance_after, "pack credits can never go negative")
    end
  end
end
```

## Transaction Types

| Type       | Credit Type | Reason          | Amount                       | Reference               |
| ---------- | ----------- | --------------- | ---------------------------- | ----------------------- |
| `allocate` | `plan`      | `plan_renewal`  | + PlanTier.details[:credits] | Pay::Subscription       |
| `consume`  | `plan`      | `ai_generation` | - credits used               | llm_run (run_id UUID)   |
| `consume`  | `pack`      | `ai_generation` | - credits used               | llm_run (run_id UUID)   |
| `purchase` | `pack`      | `pack_purchase` | + pack credits               | CreditPack              |
| `refund`   | `pack`      | `refund`        | - credits DEDUCTED (punitive) | Pay::Charge (or nil)    |
| `gift`     | `pack`      | `gift`          | + amount_cents               | nil (admin in metadata) |

> **Important**: `PlanTier.details[:credits]` is the authoritative source for plan credit amounts. Do not use `TierLimit` or `PlanLimit`.

## CreditBalance Query Class

> **Cache Strategy**: Cache is invalidated synchronously on every write operation. No TTL-based drift.
> This ensures accurate balances during rapid usage, at the cost of more cache churn.

```ruby
class CreditBalance
  def initialize(account)
    @account = account
  end

  # Returns [total, plan, pack]
  # Cached until invalidate! is called (synchronous invalidation on writes)
  def current
    Rails.cache.fetch(cache_key) do
      @account.credit_transactions
        .order(created_at: :desc)
        .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]
    end
  end

  def total
    current[0]
  end

  def plan
    current[1]
  end

  def pack
    current[2]
  end

  def breakdown
    total, plan, pack = current
    { total: total, plan: plan, pack: pack }
  end

  # Usage percentage based on TOTAL allocation (plan + active pack purchases)
  # Returns 0-100+ (can exceed 100 if negative balance)
  #
  # Formula: ((total_allocation - total_balance) / total_allocation) * 100
  #
  # Why total usage matters for model selection:
  # - Power users who buy packs deserve access to best models
  # - Someone with 5000 plan + 3000 pack purchase who's used 4000 credits
  #   is at 50% usage (4000/8000), not 80% (4000/5000)
  #
  # The is_used flag on CreditPackPurchase ensures fully-consumed packs
  # don't skew the percentage. Once a pack is exhausted, it drops out
  # of the allocation calculation.
  def usage_percentage
    plan_allocation = @account.plan&.plan_tier&.credits || 0
    pack_allocation = @account.credit_pack_purchases
      .where(is_used: false)
      .sum(:credits_purchased)

    total_allocation = plan_allocation + pack_allocation
    return 0 if total_allocation == 0

    total_used = total_allocation - total
    ((total_used.to_f / total_allocation) * 100).round(2)
  end

  def invalidate!
    Rails.cache.delete(cache_key)
  end

  private

  def cache_key
    "credit_balance:#{@account.id}"
  end

  # Class methods for convenience
  class << self
    def for(account)
      new(account)
    end

    def total(account)
      new(account).total
    end

    def breakdown(account)
      new(account).breakdown
    end

    def usage_percentage(account)
      new(account).usage_percentage
    end
  end
end
```

## CreditConsumptionService

```ruby
class CreditConsumptionService
  def initialize(account)
    @account = account
  end

  # Consume credits for an LLM run
  # FIFO order: plan credits first, then pack credits
  #
  # IMPORTANT: Negative balance rules:
  # - Plan credits CAN go negative (debt absorbed next month)
  # - Pack credits can NEVER go negative
  # - Order: deplete plan → deplete pack → plan goes negative
  def consume!(amount:, reference_id:, reference_type:, metadata: {})
    transactions = []

    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      remaining = amount

      # 1. Consume from plan credits first (if positive)
      if plan_bal > 0 && remaining > 0
        plan_consumed = [remaining, plan_bal].min
        remaining -= plan_consumed

        new_plan = plan_bal - plan_consumed
        new_total = total - plan_consumed

        transactions << create_transaction!(
          transaction_type: "consume",
          credit_type: "plan",
          reason: "ai_generation",
          amount: -plan_consumed,
          balance_after: new_total,
          plan_balance_after: new_plan,
          pack_balance_after: pack_bal,
          reference_id: reference_id,
          reference_type: reference_type,
          metadata: metadata
        )

        total, plan_bal = new_total, new_plan
      end

      # 2. Consume from pack credits (if positive and still need more)
      if pack_bal > 0 && remaining > 0
        pack_consumed = [remaining, pack_bal].min
        remaining -= pack_consumed

        new_pack = pack_bal - pack_consumed
        new_total = total - pack_consumed

        transactions << create_transaction!(
          transaction_type: "consume",
          credit_type: "pack",
          reason: "ai_generation",
          amount: -pack_consumed,
          balance_after: new_total,
          plan_balance_after: plan_bal,
          pack_balance_after: new_pack,
          reference_id: reference_id,
          reference_type: reference_type,
          metadata: metadata
        )

        total, pack_bal = new_total, new_pack
      end

      # 3. If still remaining, plan goes negative (pack NEVER goes negative)
      if remaining > 0
        new_plan = plan_bal - remaining  # Plan absorbs the debt
        new_total = total - remaining

        transactions << create_transaction!(
          transaction_type: "consume",
          credit_type: "plan",
          reason: "ai_generation",
          amount: -remaining,
          balance_after: new_total,
          plan_balance_after: new_plan,
          pack_balance_after: pack_bal,  # Pack stays at 0
          reference_id: reference_id,
          reference_type: reference_type,
          metadata: metadata.merge(debt_incurred: remaining)
        )
      end

      # Invalidate cache synchronously (not TTL-based)
      CreditBalance.for(@account).invalidate!
    end

    transactions
  end

  private

  def current_balances
    @account.credit_transactions
      .order(created_at: :desc)
      .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]
  end

  def create_transaction!(attrs)
    @account.credit_transactions.create!(attrs)
  end
end
```

## CreditAllocationService

```ruby
class CreditAllocationService
  def initialize(account)
    @account = account
  end

  # Allocate monthly plan credits
  # - Forfeits unused plan credits
  # - Preserves pack credits
  # - Absorbs any debt from new allocation
  def allocate_plan_credits!(billing_period:)
    plan_tier = @account.plan&.plan_tier
    raise "Account has no plan tier" unless plan_tier

    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      # Calculate debt (negative total balance)
      debt = [total, 0].min.abs

      # New allocation minus any debt
      new_plan = plan_tier.credits - debt
      new_pack = [pack_bal, 0].max  # pack stays same (can't be negative from this op)
      new_total = new_plan + new_pack

      create_transaction!(
        transaction_type: "allocate",
        credit_type: "plan",
        reason: "plan_renewal",
        amount: plan_tier.credits,
        balance_after: new_total,
        plan_balance_after: new_plan,
        pack_balance_after: new_pack,
        reference: @account.subscriptions.active.first,
        metadata: {
          plan_tier: plan_tier.name,
          billing_period: billing_period,
          credits_allocated: plan_tier.credits,
          debt_absorbed: debt,
          plan_credits_forfeited: [plan_bal, 0].max
        }
      )

      CreditBalance.for(@account).invalidate!
    end
  end

  # Add pack credits from purchase
  def add_pack_credits!(credit_pack:)
    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      new_pack = pack_bal + credit_pack.credits_purchased
      new_total = total + credit_pack.credits_purchased

      create_transaction!(
        transaction_type: "purchase",
        credit_type: "pack",
        reason: "pack_purchase",
        amount: credit_pack.credits_purchased,
        balance_after: new_total,
        plan_balance_after: plan_bal,
        pack_balance_after: new_pack,
        reference: credit_pack,
        metadata: {
          pack_id: credit_pack.id,
          price_cents: credit_pack.price_cents
        }
      )

      CreditBalance.for(@account).invalidate!
    end
  end

  # Process a refund - PUNITIVE: deducts credits
  #
  # When a customer refunds after using credits, we DEDUCT those credits
  # because we already incurred the AI cost. This is NOT restorative.
  #
  # Example: Customer buys $50 pack (1250 credits), uses 500 credits, then refunds.
  # We deduct 1250 credits (what they got). If they don't have enough pack credits,
  # the deduction comes from plan credits or goes negative.
  def process_refund!(credit_pack_purchase:, admin: nil)
    credits_to_deduct = credit_pack_purchase.credits_purchased

    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      # Deduct from pack first, then plan if needed
      pack_deducted = [credits_to_deduct, [pack_bal, 0].max].min
      remaining = credits_to_deduct - pack_deducted
      plan_deducted = remaining  # Plan absorbs the rest (can go negative)

      new_pack = pack_bal - pack_deducted
      new_plan = plan_bal - plan_deducted
      new_total = new_pack + new_plan

      create_transaction!(
        transaction_type: "refund",
        credit_type: pack_deducted > 0 ? "pack" : "plan",
        reason: "refund",
        amount: -credits_to_deduct,  # Negative = deduction
        balance_after: new_total,
        plan_balance_after: new_plan,
        pack_balance_after: new_pack,
        reference: credit_pack_purchase.pay_charge,
        metadata: {
          credit_pack_purchase_id: credit_pack_purchase.id,
          credits_refunded: credits_to_deduct,
          admin_id: admin&.id,
          note: "Punitive refund: credits deducted for refunded purchase"
        }
      )

      # Mark the pack purchase as used (it's been refunded)
      credit_pack_purchase.update!(is_used: true)

      CreditBalance.for(@account).invalidate!
    end
  end

  # Gift credits (customer support, partnership, testing, etc.)
  # Credits = amount_cents (e.g., $1.00 gift = 100 credits)
  def gift!(amount_cents:, gift_reason:, admin:, notes: nil)
    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      # Gifts always go to pack balance (never expire)
      new_pack = pack_bal + amount_cents
      new_total = total + amount_cents

      create_transaction!(
        transaction_type: "gift",
        credit_type: "pack",
        reason: "gift",
        amount: amount_cents,
        balance_after: new_total,
        plan_balance_after: plan_bal,
        pack_balance_after: new_pack,
        reference: nil,
        metadata: {
          gift_reason: gift_reason,
          admin_id: admin.id,
          admin_email: admin.email,
          notes: notes
        }
      )

      CreditBalance.for(@account).invalidate!
    end
  end

  private

  def current_balances
    @account.credit_transactions
      .order(created_at: :desc)
      .pick(:balance_after, :plan_balance_after, :pack_balance_after) || [0, 0, 0]
  end

  def create_transaction!(attrs)
    @account.credit_transactions.create!(attrs)
  end
end
```

## Background Workers

> **Naming Convention**: All credit-related Sidekiq workers use the `Credits::` namespace with a `Worker` suffix following Sidekiq conventions.

### Credits::ChargeRunWorker

Called after Langgraph persists usage records to `llm_usage`. Processes a specific `run_id`.

```ruby
class Credits::ChargeRunWorker
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
      "COUNT(*) as llm_call_count",
      "SUM(input_tokens) as total_input_tokens",
      "SUM(output_tokens) as total_output_tokens"
    ).first

    chat = Chat.find(run_summary.chat_id)
    account = chat.project.account
    credits = CreditCalculator.credits_for_cost(run_summary.total_cost_usd)

    ApplicationRecord.transaction do
      CreditConsumptionService.new(account).consume!(
        amount: credits,
        reference_id: run_id,
        reference_type: "llm_run",
        metadata: {
          graph_name: run_summary.graph_name,
          llm_call_count: run_summary.llm_call_count,
          cost_usd: run_summary.total_cost_usd.to_f
        }
      )

      # Mark all records for this run as processed
      records.update_all(processed_at: Time.current)
    end
  end
end
```

### Credits::ResetPlanCreditsWorker

Triggered on subscription renewal or plan changes.

```ruby
class Credits::ResetPlanCreditsWorker
  include Sidekiq::Worker
  sidekiq_options queue: :billing

  def perform(account_id, billing_period:)
    account = Account.find(account_id)
    CreditAllocationService.new(account).allocate_plan_credits!(
      billing_period: billing_period
    )
  end
end
```

### Credits::FindUnprocessedRunsWorker

Backup polling job. Catches any runs where the API notification failed.

```ruby
class Credits::FindUnprocessedRunsWorker
  include Sidekiq::Worker
  sidekiq_options queue: :billing

  STALE_THRESHOLD = 2.minutes

  def perform
    # Find run_ids where records are unprocessed and older than threshold
    stale_run_ids = LlmUsage
      .where(processed_at: nil)
      .where("created_at < ?", STALE_THRESHOLD.ago)
      .distinct
      .pluck(:run_id)

    stale_run_ids.each do |run_id|
      # Enqueue each run separately - idempotent, safe to re-enqueue
      Credits::ChargeRunWorker.perform_async(run_id)
    end

    Rails.logger.info("[FindUnprocessedRunsWorker] Enqueued #{stale_run_ids.count} stale runs")
  end
end
```

## API Endpoints

### GET /api/v1/credits/balance

Returns current balance for pre-run authorization check.

```ruby
# app/controllers/api/v1/credits_controller.rb
class Api::V1::CreditsController < Api::V1::BaseController
  def balance
    balance = CreditBalance.for(current_account)

    render json: {
      total: balance.total,
      plan: balance.plan,
      pack: balance.pack,
      usage_percentage: balance.usage_percentage,
      plan_allocation: current_account.plan&.plan_tier&.credits || 0
    }
  end
end
```

### POST /api/v1/llm_usage/notify

Called by Langgraph after writing `llm_usage` directly to Postgres. Rails enqueues a job to process the run.

> **Note**: Langgraph writes usage records directly to Postgres (shared database). This endpoint simply notifies Rails to process credits. There is no `LlmRun` model - the `run_id` is a UUID grouping key.

```ruby
# app/controllers/api/v1/llm_usage_controller.rb
module Api
  module V1
    class LlmUsageController < Api::V1::BaseController
      # POST /api/v1/llm_usage/notify
      # Called by Langgraph after writing llm_usage to Postgres
      #
      # Parameters:
      #   run_id: string (required) - UUID of the run to process
      #
      # Response:
      #   202 Accepted - Job enqueued
      def notify
        run_id = params.require(:run_id)

        # Enqueue job to process this specific run
        Credits::ChargeRunWorker.perform_async(run_id)

        head :accepted
      end
    end
  end
end
```

## Querying

### Current Balance (Hot Path)

```ruby
CreditBalance.for(account).total
CreditBalance.for(account).breakdown
CreditBalance.for(account).usage_percentage
```

### Historical Balance at Point in Time

```ruby
account.credit_transactions
  .where("created_at <= ?", timestamp)
  .order(created_at: :desc)
  .pick(:balance_after, :plan_balance_after, :pack_balance_after)
```

### Usage for Billing Period

```ruby
account.credit_transactions
  .where(transaction_type: "consume")
  .for_period(period_start, period_end)
  .sum(:amount)
  .abs
```

### Transactions for a Specific Run

```ruby
# run_id is a UUID string, not a model ID
CreditTransaction.where(reference_type: "llm_run", reference_id: run_id)
```

### Feature-Level Breakdown

```ruby
# Query via metadata (graph_name is stored in transaction metadata)
account.credit_transactions
  .where(transaction_type: "consume")
  .for_period(period_start, period_end)
  .group("metadata->>'graph_name'")
  .sum(:amount)
```

## Related Documents

- [credit-system-queries.md](./credit-system-queries.md) - Query patterns and requirements
- [langgraph_integration.md](./langgraph_integration.md) - How Langgraph tracks and reports usage
- [credit-packs.md](./credit-packs.md) - Pack definitions and purchase flow
- [credit-packs.md#resolved-decisions-qa-summary](./credit-packs.md#resolved-decisions-qa-summary) - All resolved Q&A decisions
