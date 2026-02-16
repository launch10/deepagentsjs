# Scope 3: Critical Fixes Execution Plan

## Overview

This plan addresses critical issues identified in the architectural review of Scope 3 (Subscription Lifecycle). The focus is on production-readiness, data integrity, and testing public interfaces rather than internal plumbing.

**Observability is deferred** to a follow-up scope.

---

## Priority Order

| #   | Issue                                             | Severity | Effort  |
| --- | ------------------------------------------------- | -------- | ------- |
| 1   | PaySubscriptionCredits concern (showstopper)      | P0       | Medium  |
| 2   | `update_columns` transaction isolation bug        | P0       | Low     |
| 3   | Expire transaction missing idempotency key        | P0       | Low     |
| 4   | `.new.perform` → `.perform_async` in batch worker | P1       | Trivial |
| 5   | SQL interpolation → parameterized queries         | P1       | Low     |
| 6   | Balance sequence validation                       | P1       | Medium  |
| 7   | Remove duplicate idempotency check in worker      | P1       | Trivial |
| 8   | Downgrade after upgrade edge case                 | P2       | Medium  |
| 9   | Rewrite tests for public interfaces               | P1       | Medium  |

---

## 1. PaySubscriptionCredits Concern (SHOWSTOPPER)

### Problem

Monthly subscribers never get credits allocated automatically. The webhook integration is completely missing.

### Implementation

Create `app/models/concerns/pay_subscription_credits.rb`:

```ruby
# frozen_string_literal: true

module PaySubscriptionCredits
  extend ActiveSupport::Concern

  included do
    after_commit :handle_subscription_created, on: :create
    after_commit :handle_subscription_updated, on: :update
  end

  private

  def handle_subscription_created
    return unless should_allocate_credits?

    Credits::ResetPlanCreditsWorker.perform_async(id)
  end

  def handle_subscription_updated
    return unless should_allocate_credits?
    return unless renewal_or_plan_change?

    Credits::ResetPlanCreditsWorker.perform_async(id, previous_plan_id: previous_plan_id_for_change)
  end

  def should_allocate_credits?
    return false unless customer&.owner.is_a?(Account)
    return false unless active?
    true
  end

  def renewal_or_plan_change?
    saved_change_to_current_period_start? || saved_change_to_processor_plan?
  end

  def previous_plan_id_for_change
    return nil unless saved_change_to_processor_plan?

    old_processor_plan = saved_change_to_processor_plan.first
    Plan.find_by(fake_processor_id: old_processor_plan)&.id ||
      Plan.find_by(name: old_processor_plan)&.id
  end
end
```

Update `config/initializers/pay.rb`:

```ruby
Rails.application.config.to_prepare do
  Pay::Subscription.include(PaySubscriptionCredits)
end
```

Update `Credits::ResetPlanCreditsWorker` to accept `previous_plan_id`:

```ruby
def perform(subscription_id, previous_plan_id: nil)
  subscription = Pay::Subscription.find(subscription_id)
  return unless subscription.active?

  account = subscription.customer.owner
  idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"

  previous_plan = previous_plan_id ? Plan.find(previous_plan_id) : nil

  Credits::AllocationService.new(account).reset_plan_credits!(
    subscription: subscription,
    idempotency_key: idempotency_key,
    previous_plan: previous_plan
  )
end
```

### Files to Create

- `app/models/concerns/pay_subscription_credits.rb`
- `spec/models/concerns/pay_subscription_credits_spec.rb`

### Files to Modify

- `config/initializers/pay.rb`
- `app/workers/credits/reset_plan_credits_worker.rb`

---

## 2. Fix `update_columns` Transaction Isolation Bug

### Problem

`update_columns` bypasses ActiveRecord and doesn't participate in the transaction. If the transaction rolls back, account columns remain corrupted.

### Fix

In `app/models/credit_transaction.rb`:

```ruby
# BEFORE (broken)
def update_account_balances
  account.update_columns(
    plan_credits: plan_balance_after,
    pack_credits: pack_balance_after,
    total_credits: balance_after
  )
end

# AFTER (participates in transaction)
def update_account_balances
  account.update!(
    plan_credits: plan_balance_after,
    pack_credits: pack_balance_after,
    total_credits: balance_after
  )
end
```

### Test

Add test in `spec/models/credit_transaction_spec.rb`:

```ruby
describe "transaction rollback" do
  it "does not update account if transaction is rolled back" do
    account = create(:account, plan_credits: 1000, total_credits: 1000)

    expect {
      Account.transaction do
        account.credit_transactions.create!(
          transaction_type: "allocate",
          credit_type: "plan",
          reason: "plan_renewal",
          amount: 5000,
          balance_after: 6000,
          plan_balance_after: 6000,
          pack_balance_after: 0
        )
        raise ActiveRecord::Rollback
      end
    }.not_to change { account.reload.plan_credits }
  end
end
```

---

## 3. Add Idempotency Key to Expire Transaction

### Problem

If process crashes between expire and allocate, retry skips via allocate idempotency but expire already exists with wrong balance.

### Fix

In `app/services/credits/allocation_service.rb`:

```ruby
def expire_plan_credits!(subscription:, plan_bal:, pack_bal:, total:, idempotency_key:)
  expire_key = idempotency_key.gsub("plan_credits:", "expire:")

  # Skip if already expired for this period
  return if CreditTransaction.exists?(idempotency_key: expire_key)

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
    idempotency_key: expire_key,  # ADD THIS
    metadata: {expired_credits: plan_bal}
  )
end
```

Update all callers to pass `idempotency_key`:

```ruby
# In handle_renewal! and handle_upgrade!
expire_plan_credits!(
  subscription: subscription,
  plan_bal: plan_bal,
  pack_bal: pack_bal,
  total: total,
  idempotency_key: idempotency_key  # Pass through
)
```

---

## 4. Fix Synchronous Batch Processing

### Problem

`AnnualSubscriberMonthlyAllocationWorker` calls `.new.perform` which blocks. 10,000 accounts = hours of blocking.

### Fix

In `app/workers/credits/daily_reconciliation_worker.rb`:

```ruby
# BEFORE
accounts.each do |account|
  Credits::ReconcileOneAccountWorker.new.perform(account.id)
end

# AFTER
accounts.each do |account|
  Credits::ReconcileOneAccountWorker.perform_async(account.id)
end
```

---

## 5. Fix SQL Interpolation

### Problem

String interpolation in SQL is a bad pattern, even with trusted input.

### Fix

In `app/workers/credits/daily_reconciliation_worker.rb`:

```ruby
def has_current_period_allocation_sql(today)
  month_start = today.beginning_of_month
  month_end = today.next_month.beginning_of_month

  # Use sanitize_sql_array for safe interpolation
  ApplicationRecord.sanitize_sql_array([
    <<~SQL.squish,
      EXISTS (
        SELECT 1 FROM credit_transactions ct
        WHERE ct.account_id = accounts.id
        AND ct.transaction_type = 'allocate'
        AND ct.reason IN ('plan_renewal', 'plan_upgrade')
        AND ct.created_at >= ?
        AND ct.created_at < ?
      )
    SQL
    month_start,
    month_end
  ])
end
```

---

## 6. Add Balance Sequence Validation

### Problem

No validation that `balance_after == previous_balance + amount`. Silent drift possible.

### Fix

In `app/models/credit_transaction.rb`:

```ruby
validate :balance_sequence_is_valid, on: :create

private

def balance_sequence_is_valid
  previous = account.credit_transactions.where.not(id: id).order(created_at: :desc, id: :desc).first

  if previous
    expected_total = previous.balance_after + amount
    expected_plan = previous.plan_balance_after + plan_delta
    expected_pack = previous.pack_balance_after + pack_delta

    if balance_after != expected_total
      errors.add(:balance_after, "sequence error: expected #{expected_total}, got #{balance_after}")
    end
  else
    # First transaction - balance should equal amount for credits, or validate starting state
    if balance_after != plan_balance_after + pack_balance_after
      errors.add(:balance_after, "must equal plan + pack for first transaction")
    end
  end
end

def plan_delta
  credit_type == "plan" ? amount : 0
end

def pack_delta
  credit_type == "pack" ? amount : 0
end
```

**Note**: This needs careful handling for expire+allocate pairs. May need to reconsider.

---

## 7. Remove Duplicate Idempotency Check

### Problem

Check happens outside transaction (racey) and inside (correct). Outer is misleading.

### Fix

In `app/workers/credits/reset_plan_credits_worker.rb`:

```ruby
def perform(subscription_id, previous_plan_id: nil)
  subscription = Pay::Subscription.find(subscription_id)
  return unless subscription.active?

  account = subscription.customer.owner
  idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"

  # REMOVE THIS - it's checked inside the transaction with proper locking
  # return if CreditTransaction.exists?(idempotency_key: idempotency_key)

  previous_plan = previous_plan_id ? Plan.find(previous_plan_id) : nil

  Credits::AllocationService.new(account).reset_plan_credits!(
    subscription: subscription,
    idempotency_key: idempotency_key,
    previous_plan: previous_plan
  )
end
```

---

## 8. Fix Downgrade After Upgrade Edge Case

### Problem

If user upgrades then downgrades in same period, usage calculation is wrong.

### Fix

Track actual usage instead of inferring from balance. In `AllocationService#handle_downgrade!`:

```ruby
def handle_downgrade!(subscription:, new_plan_tier:, previous_plan:, current_balances:, idempotency_key:)
  total, plan_bal, pack_bal = current_balances

  # Get actual consumption this period from transactions
  period_start = subscription.current_period_start
  usage_this_period = account.credit_transactions
    .where(transaction_type: "consume", credit_type: "plan")
    .where("created_at >= ?", period_start)
    .sum(:amount)
    .abs

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
      previous_plan_credits: previous_plan.plan_tier.credits,
      new_plan_credits: new_plan_tier.credits,
      usage_this_period: usage_this_period,
      pro_rated_balance: new_balance
    }
  )
end
```

---

## 9. Rewrite Tests for Public Interfaces

### Philosophy

**Test the subscription lifecycle, not the plumbing.**

Users don't call `AllocationService#reset_plan_credits!`. They:

- Subscribe to a plan
- Renew their subscription
- Upgrade their plan
- Downgrade their plan
- Cancel their subscription

Tests should simulate these events and verify credits are correct.

### New Test Structure

Delete or minimize:

- `spec/services/credits/allocation_service_spec.rb` (internal plumbing)
- `spec/workers/credits/reset_plan_credits_worker_spec.rb` (internal plumbing)

Create:

- `spec/integration/credits/subscription_lifecycle_spec.rb`

### Test File

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Subscription Credit Lifecycle", type: :integration do
  include ActiveSupport::Testing::TimeHelpers

  let(:account) { create(:account) }
  let(:starter_tier) { create(:plan_tier, :starter) }  # 2000 credits
  let(:growth_tier) { create(:plan_tier, :growth) }    # 5000 credits
  let(:pro_tier) { create(:plan_tier, :pro) }          # 15000 credits

  let(:starter_monthly) { create(:plan, :starter_monthly, plan_tier: starter_tier) }
  let(:growth_monthly) { create(:plan, :growth_monthly, plan_tier: growth_tier) }
  let(:growth_annual) { create(:plan, :growth_annual, plan_tier: growth_tier) }
  let(:pro_monthly) { create(:plan, :pro_monthly, plan_tier: pro_tier) }

  def subscribe_to(plan)
    processor = account.set_payment_processor(:fake_processor, allow_fake: true)
    processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}") unless processor.processor_id

    processor.subscriptions.create!(
      processor_id: "sub_#{SecureRandom.hex(8)}",
      name: "default",
      processor_plan: plan.fake_processor_id || plan.name,
      status: "active",
      current_period_start: Time.current,
      current_period_end: plan.yearly? ? 1.year.from_now : 1.month.from_now
    )
  end

  def simulate_renewal(subscription)
    new_period_start = subscription.current_period_end
    subscription.update!(
      current_period_start: new_period_start,
      current_period_end: subscription.plan.yearly? ? new_period_start + 1.year : new_period_start + 1.month
    )
  end

  def change_plan(subscription, new_plan)
    subscription.update!(processor_plan: new_plan.fake_processor_id || new_plan.name)
  end

  def consume_credits(amount)
    current = account.reload
    account.credit_transactions.create!(
      transaction_type: "consume",
      credit_type: "plan",
      reason: "ai_generation",
      amount: -amount,
      balance_after: current.total_credits - amount,
      plan_balance_after: current.plan_credits - amount,
      pack_balance_after: current.pack_credits,
      reference_type: "llm_run",
      reference_id: SecureRandom.uuid
    )
  end

  describe "new subscription" do
    it "allocates plan credits on first subscription" do
      subscription = subscribe_to(growth_monthly)

      account.reload
      expect(account.total_credits).to eq(5000)
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(0)

      expect(account.credit_transactions.count).to eq(1)
      expect(account.credit_transactions.last.transaction_type).to eq("allocate")
    end

    it "is idempotent - duplicate webhook does not double-allocate" do
      subscription = subscribe_to(growth_monthly)

      # Simulate duplicate webhook
      Credits::ResetPlanCreditsWorker.new.perform(subscription.id)

      account.reload
      expect(account.total_credits).to eq(5000)
      expect(account.credit_transactions.count).to eq(1)
    end
  end

  describe "monthly renewal" do
    it "expires unused credits and allocates fresh credits" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(1000)  # Use 1000 of 5000

      account.reload
      expect(account.plan_credits).to eq(4000)

      # Simulate renewal
      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(5000)  # Fresh allocation
        expect(account.total_credits).to eq(5000)

        # Should have: allocate, consume, expire, allocate
        expect(account.credit_transactions.where(transaction_type: "expire").count).to eq(1)
        expect(account.credit_transactions.where(transaction_type: "allocate").count).to eq(2)
      end
    end

    it "absorbs debt from previous period" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(5000)  # Use all credits

      # Simulate going negative (pack exhausted scenario)
      account.update!(plan_credits: -1000, total_credits: -1000)

      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(4000)  # 5000 - 1000 debt
        expect(account.total_credits).to eq(4000)
      end
    end
  end

  describe "plan upgrade" do
    it "gives full new plan credits on upgrade" do
      subscription = subscribe_to(starter_monthly)
      consume_credits(1000)  # Use half

      account.reload
      expect(account.plan_credits).to eq(1000)

      # Upgrade to Growth
      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(5000)  # Full new allocation
      expect(account.total_credits).to eq(5000)

      allocate = account.credit_transactions.where(transaction_type: "allocate").last
      expect(allocate.reason).to eq("plan_upgrade")
    end
  end

  describe "plan downgrade" do
    it "pro-rates balance based on usage" do
      subscription = subscribe_to(pro_monthly)  # 15000 credits
      consume_credits(5000)  # Use 5000

      account.reload
      expect(account.plan_credits).to eq(10000)

      # Downgrade to Growth (5000 credits)
      # Usage = 5000, new plan = 5000
      # Pro-rated balance = 5000 - 5000 = 0
      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(0)

      adjust = account.credit_transactions.where(transaction_type: "adjust").last
      expect(adjust.reason).to eq("plan_downgrade")
    end

    it "floors at zero - no negative from downgrade" do
      subscription = subscribe_to(pro_monthly)  # 15000 credits
      consume_credits(10000)  # Use 10000

      # Downgrade to Growth (5000 credits)
      # Usage = 10000, new plan = 5000
      # Pro-rated = 5000 - 10000 = -5000 → floored to 0
      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(0)
      expect(account.plan_credits).to be >= 0  # Never negative from downgrade
    end
  end

  describe "yearly subscription monthly reset" do
    it "resets credits monthly on billing anchor day" do
      subscription = subscribe_to(growth_annual)
      consume_credits(3000)

      account.reload
      expect(account.plan_credits).to eq(2000)

      # Travel to next month's billing day
      billing_day = subscription.current_period_start.day
      next_reset = (Date.current + 1.month).beginning_of_month + (billing_day - 1).days

      travel_to next_reset do
        Credits::AnnualSubscriberMonthlyAllocationWorker.new.perform

        account.reload
        expect(account.plan_credits).to eq(5000)  # Fresh allocation
      end
    end

    it "handles anchor day > days in month (31st → Feb 28)" do
      # Create subscription starting Jan 31
      travel_to Date.new(2026, 1, 31) do
        subscription = subscribe_to(growth_annual)
        consume_credits(2000)
      end

      # February only has 28 days, should reset on Feb 28
      travel_to Date.new(2026, 2, 28) do
        Credits::AnnualSubscriberMonthlyAllocationWorker.new.perform

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end
  end

  describe "pack credits preservation" do
    it "preserves pack credits across renewal" do
      subscription = subscribe_to(growth_monthly)

      # Add pack credits
      account.update!(pack_credits: 500, total_credits: 5500)

      consume_credits(3000)  # Use plan credits

      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(500)  # Preserved
        expect(account.total_credits).to eq(5500)
      end
    end
  end

  describe "edge cases" do
    it "handles first subscription with zero credits (no expire needed)" do
      subscription = subscribe_to(growth_monthly)

      expect(account.credit_transactions.where(transaction_type: "expire").count).to eq(0)
      expect(account.credit_transactions.where(transaction_type: "allocate").count).to eq(1)
    end

    it "handles full usage (zero balance, no expire needed)" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(5000)

      account.reload
      expect(account.plan_credits).to eq(0)

      travel 1.month do
        simulate_renewal(subscription)

        # No expire (nothing to expire), just allocate
        period_transactions = account.credit_transactions.where("created_at > ?", 1.day.ago)
        expect(period_transactions.where(transaction_type: "expire").count).to eq(0)
        expect(period_transactions.where(transaction_type: "allocate").count).to eq(1)
      end
    end
  end
end
```

---

## Execution Checklist

- [ ] 1. Create `PaySubscriptionCredits` concern
- [ ] 2. Update `pay.rb` initializer
- [ ] 3. Update `ResetPlanCreditsWorker` to accept `previous_plan_id`
- [ ] 4. Fix `update_columns` → `update!` in CreditTransaction callback
- [ ] 5. Add idempotency key to expire transactions
- [ ] 6. Fix `.new.perform` → `.perform_async`
- [ ] 7. Fix SQL interpolation with `sanitize_sql_array`
- [ ] 8. Add balance sequence validation
- [ ] 9. Remove duplicate idempotency check
- [ ] 10. Fix downgrade usage calculation
- [ ] 11. Write integration tests for subscription lifecycle
- [ ] 12. Run full test suite
- [ ] 13. Manual testing: create subscription, upgrade, downgrade, renew

---

## Out of Scope (Deferred)

- Observability/metrics (separate scope)
- Alerting for anomalies
- Admin UI for credit management
