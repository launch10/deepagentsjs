# CreditTransaction Data Model

## Overview

`CreditTransaction` is the single source of truth for credit balances. Every balance-changing event creates a transaction with running balance snapshots.

## Schema

```ruby
create_table :credit_transactions do |t|
  t.references :account, null: false, foreign_key: true

  # Transaction classification
  t.string :transaction_type, null: false  # allocate, consume, purchase, refund, adjust
  t.string :credit_type, null: false       # plan, pack
  t.string :reason, null: false            # ai_generation, plan_renewal, pack_purchase, support_credit

  # Amount and running balances
  t.integer :amount, null: false           # positive = credit, negative = debit
  t.integer :balance_after, null: false    # total balance after this transaction
  t.integer :plan_balance_after, null: false
  t.integer :pack_balance_after, null: false

  # Polymorphic reference to source record
  t.references :reference, polymorphic: true, null: true  # LlmRun, CreditPack, Subscription, etc.

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
  belongs_to :reference, polymorphic: true, optional: true

  # Enums
  enum :transaction_type, {
    allocate: "allocate",   # monthly plan credits
    consume: "consume",     # usage (LLM calls)
    purchase: "purchase",   # bought a credit pack
    refund: "refund",       # money back (adds credits)
    adjust: "adjust"        # manual adjustment (support)
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
    support_credit
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

  # Callbacks
  validate :balances_are_consistent

  private

  def balances_are_consistent
    expected_total = plan_balance_after + pack_balance_after
    if balance_after != expected_total
      errors.add(:balance_after, "must equal plan_balance_after + pack_balance_after")
    end
  end
end
```

## Transaction Types

| Type | Credit Type | Reason | Amount | Reference |
|------|-------------|--------|--------|-----------|
| `allocate` | `plan` | `plan_renewal` | + plan_tier.credits | Subscription |
| `consume` | `plan` | `ai_generation` | - credits used | LlmRun |
| `consume` | `pack` | `ai_generation` | - credits used | LlmRun |
| `purchase` | `pack` | `pack_purchase` | + pack credits | CreditPack |
| `refund` | `pack` | `refund` | + refunded amount | Pay::Charge (or nil) |
| `adjust` | `pack` | `support_credit` | +/- adjustment | nil |

## CreditBalance Query Class

```ruby
class CreditBalance
  CACHE_TTL = 60.seconds

  def initialize(account)
    @account = account
  end

  # Returns [total, plan, pack]
  def current
    Rails.cache.fetch(cache_key, expires_in: CACHE_TTL) do
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

  # Usage percentage for this billing period
  # Returns 0-100+ (can exceed 100 if negative balance)
  def usage_percentage
    plan_allocation = @account.plan&.plan_tier&.credits || 0
    return 0 if plan_allocation == 0

    plan_used = plan_allocation - plan
    ((plan_used.to_f / plan_allocation) * 100).round(2)
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
  # FIFO: plan credits first, then pack credits
  # Allows negative balance (debt absorbed next month)
  def consume!(amount:, reference:, metadata: {})
    transactions = []

    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      remaining = amount

      # 1. Consume from plan first
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
          reference: reference,
          metadata: metadata
        )

        total, plan_bal = new_total, new_plan
      end

      # 2. Consume from pack (can go negative)
      if remaining > 0
        new_pack = pack_bal - remaining
        new_total = total - remaining

        transactions << create_transaction!(
          transaction_type: "consume",
          credit_type: "pack",
          reason: "ai_generation",
          amount: -remaining,
          balance_after: new_total,
          plan_balance_after: plan_bal,
          pack_balance_after: new_pack,
          reference: reference,
          metadata: metadata
        )
      end

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

  # Manual adjustment (support credits, corrections)
  def adjust!(amount:, reason:, metadata: {})
    Account.transaction do
      @account.lock!

      total, plan_bal, pack_bal = current_balances

      # Adjustments always go to pack balance
      new_pack = pack_bal + amount
      new_total = total + amount

      create_transaction!(
        transaction_type: "adjust",
        credit_type: "pack",
        reason: reason,
        amount: amount,
        balance_after: new_total,
        plan_balance_after: plan_bal,
        pack_balance_after: new_pack,
        reference: nil,
        metadata: metadata
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

## Background Jobs

### Credits::ChargeRunJob

Called after Langgraph persists an `LlmRun` to Rails.

```ruby
class Credits::ChargeRunJob < ApplicationJob
  def perform(llm_run_id)
    llm_run = LlmRun.find(llm_run_id)
    return if llm_run.charged?

    account = llm_run.chat.project.account
    credits = CreditCalculator.credits_for_cost(llm_run.total_cost_usd)

    CreditConsumptionService.new(account).consume!(
      amount: credits,
      reference: llm_run,
      metadata: {
        graph: llm_run.graph_name,
        llm_call_count: llm_run.llm_call_count,
        cost_usd: llm_run.total_cost_usd
      }
    )

    llm_run.update!(
      charged: true,
      charged_at: Time.current,
      credits_charged: credits
    )
  end
end
```

### Credits::AllocatePlanCreditsJob

Triggered on subscription renewal.

```ruby
class Credits::AllocatePlanCreditsJob < ApplicationJob
  def perform(account_id, billing_period:)
    account = Account.find(account_id)
    CreditAllocationService.new(account).allocate_plan_credits!(
      billing_period: billing_period
    )
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

### POST /api/v1/llm_runs

Called by Langgraph after graph completion. Creates run and enqueues charge job.

```ruby
# app/controllers/api/v1/llm_runs_controller.rb
class Api::V1::LlmRunsController < Api::V1::BaseController
  def create
    llm_run = LlmRun.create!(llm_run_params)

    # Bulk insert usage records
    if params[:usage_records].present?
      records = params[:usage_records].map do |r|
        r.merge(llm_run_id: llm_run.id, created_at: Time.current, updated_at: Time.current)
      end
      LlmUsageRecord.insert_all(records)
    end

    # Enqueue credit charge
    Credits::ChargeRunJob.perform_later(llm_run.id)

    render json: { id: llm_run.id, run_id: llm_run.run_id }, status: :created
  end

  private

  def llm_run_params
    params.require(:llm_run).permit(
      :chat_id, :run_id, :graph_name,
      :llm_call_count, :total_input_tokens, :total_output_tokens, :total_cost_usd
    )
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
CreditTransaction.where(reference: llm_run)
```

### Feature-Level Breakdown

```ruby
account.credit_transactions
  .where(transaction_type: "consume")
  .for_period(period_start, period_end)
  .joins("LEFT JOIN llm_runs ON llm_runs.id = credit_transactions.reference_id AND credit_transactions.reference_type = 'LlmRun'")
  .group("llm_runs.graph_name")
  .sum(:amount)
```

## Related Documents

- [credit-system-queries.md](./credit-system-queries.md) - Query patterns and requirements
- [langgraph_integration.md](./langgraph_integration.md) - How Langgraph tracks and reports usage
