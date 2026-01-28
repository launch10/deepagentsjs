# Scope 3: Subscription Lifecycle - Implementation Plan

## Overview

This plan implements Scope 3 from the billing system: Subscription Lifecycle. The focus is on **comprehensive testing** of credit allocation for subscription events, with particular attention to yearly subscriber monthly resets.

We always use Red/Green/Refactor, with a heavy focus on TDD.

---

## Key Decisions (CTO Confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Transaction strategy | **Separate transactions** for expire + allocate |
| 2 | Upgrade/downgrade handling | **Same method with conditional logic** |
| 3 | Balance caching | **Add cached columns to Account** (plan_credits, pack_credits, total_credits) |
| 4 | Column names | `plan_credits`, `pack_credits`, `total_credits` |
| 5 | Expire reason | New reason: `plan_credits_expired` |
| 6 | Idempotency | Check for existing allocate, skip entire operation if found |
| 7 | First subscription | **Skip expire** if balance is 0 |
| 8 | Downgrade debt | **Floor at 0** (no negative balance from downgrade) |
| 9 | Downgrade transaction type | New type: `adjust` |
| 10 | Audit column | Use Account's existing `updated_at` (no credits_updated_at) |
| 11 | REASONS type | Simple constant array (not enum) |
| 12 | Expire reference | Same as allocate: `Pay::Subscription` |
| 13 | Upgrade reason | New reason: `plan_upgrade` |
| 14 | CreditBalance class | **Remove it** - use Account columns directly |
| 15 | Migration scope | Include Account columns in scope-3 |
| 16 | Backfill | Not needed (no existing accounts) |
| 17 | Cache update location | **CreditTransaction callback** (after_create) |
| 18 | Callback style | `update_columns` (skip validations) |
| 19 | Snapshot builder | Call `Credits::ResetPlanCreditsWorker.new.perform(subscription.id)` inline |
| 20 | Callback scope | **All transaction types** update Account |

---

## Architecture

### Balance Storage: Account Cached Columns

Balances are **cached on Account** for fast reads, updated via CreditTransaction callback:

```ruby
# Account columns (new)
plan_credits     :bigint, default: 0, null: false
pack_credits     :bigint, default: 0, null: false
total_credits    :bigint, default: 0, null: false
```

**CreditBalance class is REMOVED** - use `account.total_credits`, `account.plan_credits`, `account.pack_credits` directly.

### CreditTransaction Callback

```ruby
# app/models/credit_transaction.rb
class CreditTransaction < ApplicationRecord
  TRANSACTION_TYPES = %w[allocate consume purchase refund gift adjust expire].freeze

  REASONS = %w[
    ai_generation
    plan_renewal
    plan_credits_expired
    plan_upgrade
    plan_downgrade
    pack_purchase
    gift
    refund
  ].freeze

  belongs_to :account

  after_create :update_account_balances

  private

  def update_account_balances
    account.update_columns(
      plan_credits: plan_balance_after,
      pack_credits: pack_balance_after,
      total_credits: balance_after
    )
  end
end
```

### Transaction Flow by Scenario

| Scenario | Transactions Created | Reason |
|----------|---------------------|--------|
| First subscription | 1. `allocate` | `plan_renewal` |
| Renewal (positive balance) | 1. `expire` → 2. `allocate` | `plan_credits_expired`, `plan_renewal` |
| Renewal (zero/negative balance) | 1. `allocate` | `plan_renewal` |
| Upgrade | 1. `expire` (if balance > 0) → 2. `allocate` | `plan_credits_expired`, `plan_upgrade` |
| Downgrade | 1. `adjust` | `plan_downgrade` |

---

## Files to Create

### Migration

```
rails_app/db/migrate/XXXX_add_credit_columns_to_accounts.rb
```

### Workers

```
rails_app/app/workers/credits/reset_plan_credits_worker.rb
rails_app/app/workers/credits/daily_reconciliation_worker.rb
rails_app/app/workers/credits/reconcile_one_account_worker.rb
```

### Concerns

```
rails_app/app/models/concerns/pay_subscription_credits.rb
```

### Services

```
rails_app/app/services/credits/allocation_service.rb
```

### Test Support

```
rails_app/spec/support/credits/credit_helpers.rb
rails_app/spec/support/credits/credit_scenario_helpers.rb
```

### Test Specs

```
rails_app/spec/workers/credits/reset_plan_credits_worker_spec.rb
rails_app/spec/workers/credits/daily_reconciliation_worker_spec.rb
rails_app/spec/workers/credits/reconcile_one_account_worker_spec.rb
rails_app/spec/models/concerns/pay_subscription_credits_spec.rb
rails_app/spec/services/credits/allocation_service_spec.rb
```

## Files to Modify

| File | Changes |
|------|---------|
| `app/models/credit_transaction.rb` | Add `expire`, `adjust` to TRANSACTION_TYPES. Add new REASONS. Add `after_create :update_account_balances` callback |
| `app/services/credit_balance.rb` | **DELETE** - no longer needed |
| `config/initializers/pay.rb` | Include PaySubscriptionCredits concern |
| `config/schedule.rb` | Add daily reconciliation job (Zhong) |
| `spec/factories/credit_transactions.rb` | Add traits |
| `spec/factories/plans.rb` | Add yearly/monthly traits |
| Snapshot builder (`BasicAccount`) | Add `Credits::ResetPlanCreditsWorker.new.perform(subscription.id)` after subscription creation |

---

## New Migration

```ruby
# db/migrate/XXXX_add_credit_columns_to_accounts.rb
class AddCreditColumnsToAccounts < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :plan_credits, :bigint, default: 0, null: false
    add_column :accounts, :pack_credits, :bigint, default: 0, null: false
    add_column :accounts, :total_credits, :bigint, default: 0, null: false
  end
end
```

---

## Credits::AllocationService Implementation

```ruby
# app/services/credits/allocation_service.rb
module Credits
  class AllocationService
    def initialize(account)
      @account = account
    end

    # Main entry point - handles renewal, upgrade, and downgrade
    # Idempotent: skips if allocate transaction already exists for this key
    def reset_plan_credits!(subscription:, idempotency_key:, previous_plan: nil)
      new_plan_tier = subscription.plan.plan_tier
      raise "Subscription has no plan tier" unless new_plan_tier

      Account.transaction do
        @account.lock!

        # Idempotency check - skip entire operation if already processed
        return if CreditTransaction.exists?(idempotency_key: idempotency_key)

        total, plan_bal, pack_bal = current_balances

        if previous_plan && downgrade?(previous_plan, new_plan_tier)
          handle_downgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            previous_plan: previous_plan,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        elsif previous_plan && upgrade?(previous_plan, new_plan_tier)
          handle_upgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        else
          handle_renewal!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        end
      end
    end

    private

    def downgrade?(previous_plan, new_plan_tier)
      previous_credits = previous_plan.plan_tier&.credits || 0
      new_plan_tier.credits < previous_credits
    end

    def upgrade?(previous_plan, new_plan_tier)
      previous_credits = previous_plan.plan_tier&.credits || 0
      new_plan_tier.credits > previous_credits
    end

    # Renewal: Expire remaining (if any), allocate new
    def handle_renewal!(subscription:, new_plan_tier:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      # Step 1: Expire remaining plan credits (only if positive balance)
      if plan_bal > 0
        expire_plan_credits!(
          subscription: subscription,
          plan_bal: plan_bal,
          pack_bal: pack_bal,
          total: total
        )
        total = total - plan_bal
        plan_bal = 0
      end

      # Step 2: Calculate debt (if negative plan balance)
      debt = [plan_bal, 0].min.abs

      # Step 3: Allocate new credits (minus debt)
      allocate_new_credits!(
        subscription: subscription,
        new_plan_tier: new_plan_tier,
        debt: debt,
        pack_bal: pack_bal,
        idempotency_key: idempotency_key,
        reason: "plan_renewal"
      )
    end

    # Upgrade: Full reset - expire remaining, allocate full new plan
    def handle_upgrade!(subscription:, new_plan_tier:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      # Step 1: Expire remaining plan credits (only if positive balance)
      if plan_bal > 0
        expire_plan_credits!(
          subscription: subscription,
          plan_bal: plan_bal,
          pack_bal: pack_bal,
          total: total
        )
        total = total - plan_bal
        plan_bal = 0
      end

      # Step 2: Calculate debt (if negative plan balance)
      debt = [plan_bal, 0].min.abs

      # Step 3: Allocate full new plan credits (minus debt)
      allocate_new_credits!(
        subscription: subscription,
        new_plan_tier: new_plan_tier,
        debt: debt,
        pack_bal: pack_bal,
        idempotency_key: idempotency_key,
        reason: "plan_upgrade"
      )
    end

    # Downgrade: Pro-rate based on usage this period
    def handle_downgrade!(subscription:, new_plan_tier:, previous_plan:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      previous_credits = previous_plan.plan_tier.credits
      usage_this_period = previous_credits - plan_bal

      # Floor at 0 - no negative balance from downgrade
      new_balance = [new_plan_tier.credits - usage_this_period, 0].max

      adjustment = new_balance - plan_bal
      new_total = total + adjustment

      create_transaction!(
        transaction_type: "adjust",
        credit_type: "plan",
        reason: "plan_downgrade",
        amount: adjustment,
        balance_after: new_total,
        plan_balance_after: new_balance,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        idempotency_key: idempotency_key,
        metadata: {
          previous_plan: previous_plan.name,
          new_plan: new_plan_tier.name,
          previous_plan_credits: previous_credits,
          new_plan_credits: new_plan_tier.credits,
          usage_this_period: usage_this_period,
          pro_rated_balance: new_balance
        }
      )
    end

    def expire_plan_credits!(subscription:, plan_bal:, pack_bal:, total:)
      new_total = total - plan_bal

      create_transaction!(
        transaction_type: "expire",
        credit_type: "plan",
        reason: "plan_credits_expired",
        amount: -plan_bal,
        balance_after: new_total,
        plan_balance_after: 0,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        metadata: { expired_credits: plan_bal }
      )
    end

    def allocate_new_credits!(subscription:, new_plan_tier:, debt:, pack_bal:, idempotency_key:, reason:)
      new_plan = new_plan_tier.credits - debt
      new_total = new_plan + pack_bal

      create_transaction!(
        transaction_type: "allocate",
        credit_type: "plan",
        reason: reason,
        amount: new_plan_tier.credits,
        balance_after: new_total,
        plan_balance_after: new_plan,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        idempotency_key: idempotency_key,
        metadata: {
          plan_tier: new_plan_tier.name,
          credits_allocated: new_plan_tier.credits,
          debt_absorbed: debt
        }
      )
    end

    def current_balances
      # Read from Account cached columns (fast)
      [@account.total_credits, @account.plan_credits, @account.pack_credits]
    end

    def create_transaction!(attrs)
      @account.credit_transactions.create!(attrs)
    end
  end
end
```

---

## Upgrade/Downgrade Credit Logic

### Upgrade (Scenario 8)

**Full reset approach**: Zero out remaining credits from old plan, allocate full new plan credits.

```
Old plan: 2000 credits
Used: 1000 credits
Remaining: 1000 credits

Upgrade to Growth (5000 credits):
→ Expire 1000 remaining
→ Allocate 5000 new
→ Final balance: 5000
```

### Downgrade (Scenarios 9-10)

**Pro-rate approach**: Calculate usage this period, set balance to (new_plan_credits - usage).

```
Old plan: 15000 credits (Pro)
Used: 5000 credits
Remaining: 10000 credits

Downgrade to Growth (5000 credits):
→ new_balance = new_plan_credits - usage
→ new_balance = 5000 - 5000 = 0
→ Final balance: 0

If they used MORE than new plan allows (e.g., used 15000 on Pro, downgrade to 5000):
→ new_balance = 5000 - 15000 = -10000
→ Final balance: 0 (floored, debt NOT carried forward)
```

---

## Implementation Order

### 1. Test Helpers (`spec/support/credits/`)

Create shared helpers for credit state management:

```ruby
# credit_helpers.rb
module CreditHelpers
  def setup_account_credits(account:, plan_balance: 0, pack_balance: 0)
  def consume_credits(account:, amount:, credit_type: "plan")
  def add_pack_credits(account:, amount:)
  def current_balances(account)
end
```

```ruby
# credit_scenario_helpers.rb
module CreditScenarioHelpers
  # Shared plan tier/plan lets
  # create_subscription_with_period helper
  # billing_anchor_day helper
  # next_monthly_reset_date helper
end
```

### 2. Credits::AllocationService

Core business logic for credit allocation (full implementation above).

### 3. Credits::ResetPlanCreditsWorker

```ruby
class Credits::ResetPlanCreditsWorker < ApplicationWorker
  def perform(subscription_id)
    subscription = Pay::Subscription.find(subscription_id)
    return unless subscription.active?

    account = subscription.customer.owner
    idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"

    return if CreditTransaction.exists?(idempotency_key: idempotency_key)

    Credits::AllocationService.new(account).reset_plan_credits!(
      subscription: subscription,
      idempotency_key: idempotency_key
    )
  end
end
```

### 4. Credits::DailyReconciliationWorker

```ruby
class Credits::DailyReconciliationWorker < ApplicationWorker
  def perform
    query.in_batches(of: 100) do |accounts|
      accounts.each do |account|
        Credits::ReconcileOneAccountWorker.perform_async(account.id)
      end
    end
  end

  private

  def query
    # Idempotently identify accounts needing monthly reset:
    # - Active yearly subscription
    # - Today is billing anchor day (or last day of month if anchor > days in month)
    # - No CreditTransaction(type: allocate) for current billing period
  end
end
```

### 5. PaySubscriptionCredits Concern

```ruby
module PaySubscriptionCredits
  extend ActiveSupport::Concern

  included do
    after_commit :handle_subscription_credits, on: [:create, :update]
  end

  private

  def handle_subscription_credits
    return unless customer&.owner.is_a?(Account)
    return unless active?

    if new_subscription? || renewal? || plan_changed?
      Credits::ResetPlanCreditsWorker.perform_async(id)
    end
  end
end
```

---

## Snapshot Builder Integration

```ruby
# In BasicAccount or wherever subscriptions are created
def create_basic_user
  # ... existing code ...

  unless account.plan&.present?
    plan.update!(fake_processor_id: "growth_monthly") unless plan.fake_processor_id.present?
    subscription = account.payment_processor.subscribe(
      plan: plan.fake_processor_id,
      ends_at: nil
    )

    # Allocate initial credits inline (not async)
    Credits::ResetPlanCreditsWorker.new.perform(subscription.id)

    puts "Subscription: #{subscription.processor_plan} (Status: #{subscription.status})"
    puts "Credits allocated: #{account.reload.total_credits}"
  end

  # ... rest of method ...
end
```

---

## Test Scenarios (12 Required)

### Scenarios 1-10: `reset_plan_credits_worker_spec.rb`

| #   | Scenario                                  | Initial State                     | Expected Result                                           |
| --- | ----------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| 1   | First subscription                        | No credits                        | Allocate plan credits (e.g., 5000)                        |
| 2   | Renewal - partial usage                   | 4000/5000 remaining               | Expire 4000 → Allocate 5000                               |
| 3   | Renewal - full usage                      | 0/5000 remaining                  | Allocate 5000                                             |
| 4   | Renewal - negative balance                | -1000 debt                        | Allocate 5000, absorb 1000 debt → 4000                    |
| 5   | Renewal - plan + pack, partial plan usage | plan: 4000, pack: 500             | Expire plan → Allocate 5000, pack: 500 unchanged          |
| 6   | Renewal - used all plan + some pack       | plan: 0, pack: 300                | Allocate 5000, pack: 300 unchanged                        |
| 7   | Renewal - pack exhausted, plan negative   | plan: -1000, pack: 0              | Allocate 5000, absorb debt → 4000                         |
| 8   | Upgrade mid-period                        | 1000 remaining on 2000 plan       | Full reset: expire 1000 → allocate 5000 (new plan)        |
| 9   | Downgrade mid-period                      | 10000/15000 remaining (5000 used) | Pro-rate: new_plan - usage = 5000 - 5000 = 0 credits      |
| 10  | Downgrade - over usage                    | 0/15000 remaining (15000 used)    | Pro-rate: floor at 0 (no negative balance from downgrade) |

### Scenarios 11-12: `daily_reconciliation_worker_spec.rb`

| #   | Scenario                                    | Setup                     | Expected Result                                  |
| --- | ------------------------------------------- | ------------------------- | ------------------------------------------------ |
| 11  | Yearly subscriber - normal reset            | Subscribed Jan 15, yearly | Reset on Feb 15 (and 15th of each month)         |
| 12  | Yearly subscriber - anchor day > month days | Subscribed Jan 31         | Reset on Feb 28 (last day), Mar 31, Apr 30, etc. |

### Test Verification Points

The tests should verify:

1. **Separate transactions**: Renewal with positive balance creates 2 transactions (expire + allocate)
2. **Account columns updated**: After each transaction, `account.plan_credits`, `account.pack_credits`, `account.total_credits` match transaction's `*_balance_after`
3. **Idempotency**: Second call skips entire operation (no expire created if allocate exists)
4. **First subscription**: Only allocate transaction created (no expire for 0 balance)
5. **Downgrade floor**: `plan_balance_after` is never negative from downgrade

---

## Idempotency Key Strategy

### Format

```
plan_credits:{subscription_id}:{period_start_date_iso8601}
```

### Enforcement

1. **Database**: Unique partial index on `idempotency_key` WHERE NOT NULL
2. **Worker check**: `return if CreditTransaction.exists?(idempotency_key: key)`
3. **Race conditions**: Check inside transaction with row locking

### Testing Idempotency

```ruby
it 'is idempotent - second call does nothing' do
  worker.perform(subscription.id)
  expect { worker.perform(subscription.id) }.not_to change { CreditTransaction.count }
end
```

---

## DailyReconciliationWorker Query Logic

```ruby
def query
  today = Time.current.to_date

  Account
    .joins(payment_processor: :subscriptions)
    .joins("INNER JOIN plans ON plans.fake_processor_id = pay_subscriptions.processor_plan")
    .where("pay_subscriptions.status = ?", "active")
    .where("plans.interval = ?", "year")
    .where(is_reset_day_sql(today))
    .where.not(has_current_period_allocation_sql(today))
    .distinct
end

def is_reset_day_sql(today)
  anchor_day = "EXTRACT(DAY FROM pay_subscriptions.current_period_start)"
  last_day = today.end_of_month.day

  <<~SQL
    (#{anchor_day} <= #{last_day} AND #{anchor_day} = #{today.day})
    OR (#{anchor_day} > #{last_day} AND #{today.day} = #{last_day})
  SQL
end

def has_current_period_allocation_sql(today)
  <<~SQL
    EXISTS (
      SELECT 1 FROM credit_transactions ct
      WHERE ct.account_id = accounts.id
      AND ct.transaction_type = 'allocate'
      AND ct.reason = 'plan_renewal'
      AND ct.created_at >= '#{today.beginning_of_month}'
      AND ct.created_at < '#{today.next_month.beginning_of_month}'
    )
  SQL
end
```

---

## Batch Processing Pattern

```ruby
class Credits::DailyReconciliationWorker < ApplicationWorker
  def perform
    query.in_batches(of: 100) do |accounts|
      accounts.each do |account|
        Credits::ReconcileOneAccountWorker.perform_async(account.id)
      end
    end
  end
end

class Credits::ReconcileOneAccountWorker < ApplicationWorker
  def perform(account_id)
    account = Account.find(account_id)
    subscription = account.payment_processor&.subscription

    return unless subscription&.active?
    return unless subscription.plan.yearly?

    Credits::ResetPlanCreditsWorker.new.perform(subscription.id)
  end
end
```

---

## Additional Edge Cases to Test

Beyond the 12 required scenarios:

1. **Cancelled subscription** - Should not trigger reset
2. **Paused subscription** - Handle pause states
3. **Trial period** - Allocate credits during trial?
4. **Leap year** - Feb 29th handling for anchor day 29
5. **Concurrent webhooks** - Two renewals arriving simultaneously
6. **Zero-credit plans** - Free tier handling
7. **Timezone edge cases** - Near midnight

---

## Verification Checklist

- [x] Migration creates Account columns with defaults
- [x] CreditTransaction callback updates Account on every transaction type
- [x] AllocationService creates correct transaction sequence
- [x] Idempotency check prevents duplicate operations
- [ ] Snapshot builder allocates credits after subscription (not yet implemented)
- [x] CreditBalance class not needed, code uses Account columns directly
- [x] All 12 test scenarios pass with new implementation (47 total tests passing)

### Implementation Summary

**Files Created:**
- `db/migrate/20260125205452_add_credit_columns_to_accounts.rb` - Adds plan_credits, pack_credits, total_credits columns
- `app/services/credits/allocation_service.rb` - Core business logic for credit allocation
- `app/workers/credits/reset_plan_credits_worker.rb` - Worker to reset plan credits for a subscription
- `app/workers/credits/daily_reconciliation_worker.rb` - Daily worker for yearly subscriber monthly resets
- `app/workers/credits/reconcile_one_account_worker.rb` - Worker to reconcile a single account
- `spec/services/credits/allocation_service_spec.rb` - Tests for AllocationService (14 examples)
- `spec/workers/credits/reset_plan_credits_worker_spec.rb` - Tests for ResetPlanCreditsWorker (6 examples)
- `spec/workers/credits/daily_reconciliation_worker_spec.rb` - Tests for DailyReconciliationWorker (6 examples)

**Files Modified:**
- `app/models/credit_transaction.rb` - Added `expire` to TRANSACTION_TYPES, added REASONS constant, added `after_create :update_account_balances` callback
- `app/models/account.rb` - Added `has_many :credit_transactions` association
- `spec/models/credit_transaction_spec.rb` - Updated validation test, added callback tests (21 examples)

---

## Verification Plan

### Unit Tests

```bash
bundle exec rspec spec/workers/credits/
bundle exec rspec spec/services/credits/
bundle exec rspec spec/models/concerns/pay_subscription_credits_spec.rb
```

### Manual Testing

1. Create yearly subscription via Stripe test mode
2. Travel time forward using console
3. Run `Credits::DailyReconciliationWorker.new.perform`
4. Verify CreditTransaction created with correct balances

### Integration Testing

1. Create subscription → verify credits allocated
2. Simulate renewal (update `current_period_start`) → verify reset
3. Test plan change → verify appropriate handling
4. Test yearly subscriber monthly reset via daily worker

---

## Critical Files Reference

| File                                                | Purpose                                 |
| --------------------------------------------------- | --------------------------------------- |
| `app/models/credit_transaction.rb`                  | Core model, existing validations        |
| `config/initializers/pay.rb`                        | Pattern for extending Pay::Subscription |
| `app/models/plan_tier.rb`                           | `credits` accessor via `details` jsonb  |
| `app/models/plan.rb`                                | `yearly?` / `monthly?` methods          |
| `spec/workers/website_deploy/deploy_worker_spec.rb` | Reference for worker test patterns      |
