# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Subscription Credit Lifecycle", type: :integration do
  include ActiveSupport::Testing::TimeHelpers

  # Run Sidekiq jobs inline so credits are allocated synchronously
  around do |example|
    Sidekiq::Testing.inline! do
      example.run
    end
  end

  let(:account) { create(:account) }

  # Plan tiers with different credit amounts
  let(:starter_tier) { create(:plan_tier, :starter) }  # 2000 credits
  let(:growth_tier) { create(:plan_tier, :growth) }    # 5000 credits
  let(:pro_tier) { create(:plan_tier, :pro) }          # 15000 credits

  # Plans
  let(:starter_monthly) { create(:plan, :starter_monthly, plan_tier: starter_tier) }
  let(:growth_monthly) { create(:plan, :growth_monthly, plan_tier: growth_tier) }
  let(:growth_annual) { create(:plan, :growth_annual, plan_tier: growth_tier) }
  let(:pro_monthly) { create(:plan, :pro_monthly, plan_tier: pro_tier) }

  before do
    # Ensure plans have processor IDs for lookup
    [starter_monthly, growth_monthly, growth_annual, pro_monthly].each do |plan|
      plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?
    end
  end

  # Helper to create a subscription (simulates what happens when user subscribes)
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

  # Helper to simulate Stripe renewal webhook (updates period dates)
  def simulate_renewal(subscription)
    new_period_start = subscription.current_period_end
    subscription.update!(
      current_period_start: new_period_start,
      current_period_end: subscription.plan.yearly? ? new_period_start + 1.year : new_period_start + 1.month
    )
  end

  # Helper to simulate plan change (upgrade/downgrade)
  def change_plan(subscription, new_plan)
    subscription.update!(processor_plan: new_plan.fake_processor_id || new_plan.name)
  end

  # Helper to consume credits (simulates AI usage)
  def consume_credits(amount)
    current = account.reload
    raise "Cannot consume more plan credits than available" if amount > current.plan_credits && current.pack_credits == 0

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

  # Helper to purchase pack credits (creates proper transaction)
  def purchase_pack_credits(amount)
    current = account.reload
    account.credit_transactions.create!(
      transaction_type: "purchase",
      credit_type: "pack",
      reason: "pack_purchase",
      amount: amount,
      balance_after: current.total_credits + amount,
      plan_balance_after: current.plan_credits,
      pack_balance_after: current.pack_credits + amount,
      reference_type: "stripe_charge",
      reference_id: "ch_#{SecureRandom.hex(8)}"
    )
  end

  # Helper to set up account state with proper transaction history (for debt scenarios)
  def setup_account_state(plan_credits:, pack_credits: 0)
    total = plan_credits + pack_credits
    account.credit_transactions.create!(
      transaction_type: plan_credits >= 0 ? "allocate" : "consume",
      credit_type: "plan",
      reason: plan_credits >= 0 ? "plan_renewal" : "ai_generation",
      amount: plan_credits,
      balance_after: total,
      plan_balance_after: plan_credits,
      pack_balance_after: pack_credits,
      skip_sequence_validation: true
    )
    account.update!(plan_credits: plan_credits, pack_credits: pack_credits, total_credits: total)
  end

  describe "new subscription" do
    it "allocates plan credits when user first subscribes" do
      subscription = subscribe_to(growth_monthly)

      account.reload
      expect(account.total_credits).to eq(5000)
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(0)

      # Should have exactly one allocate transaction
      expect(account.credit_transactions.count).to eq(1)
      transaction = account.credit_transactions.last
      expect(transaction.transaction_type).to eq("allocate")
      expect(transaction.reason).to eq("plan_renewal")
      expect(transaction.amount).to eq(5000)
    end

    it "is idempotent - duplicate webhook does not double-allocate" do
      subscription = subscribe_to(growth_monthly)

      initial_credits = account.reload.total_credits
      initial_count = account.credit_transactions.count

      # Simulate duplicate webhook by calling worker again
      Credits::ResetPlanCreditsWorker.new.perform(subscription.id)

      account.reload
      expect(account.total_credits).to eq(initial_credits)
      expect(account.credit_transactions.count).to eq(initial_count)
    end

    it "allocates different amounts based on plan tier" do
      subscription = subscribe_to(starter_monthly)

      account.reload
      expect(account.plan_credits).to eq(2000)  # Starter tier

      # Create another account with Pro plan
      pro_account = create(:account)
      pro_processor = pro_account.set_payment_processor(:fake_processor, allow_fake: true)
      pro_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
      pro_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: pro_monthly.fake_processor_id,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )

      pro_account.reload
      expect(pro_account.plan_credits).to eq(15000)  # Pro tier
    end
  end

  describe "monthly subscription renewal" do
    it "expires unused credits and allocates fresh credits" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(1000)  # Use 1000 of 5000

      account.reload
      expect(account.plan_credits).to eq(4000)

      # Simulate renewal (Stripe webhook updating period)
      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(5000)  # Fresh allocation
        expect(account.total_credits).to eq(5000)

        # Verify transaction history: allocate, consume, expire, allocate
        expect(account.credit_transactions.where(transaction_type: "expire").count).to eq(1)
        expect(account.credit_transactions.where(transaction_type: "allocate").count).to eq(2)

        expire_tx = account.credit_transactions.where(transaction_type: "expire").last
        expect(expire_tx.amount).to eq(-4000)  # 4000 unused credits expired
      end
    end

    it "does not create expire transaction when no credits remain" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(5000)  # Use all credits

      account.reload
      expect(account.plan_credits).to eq(0)

      travel 1.month do
        simulate_renewal(subscription)

        # No expire transaction (nothing to expire)
        period_transactions = account.credit_transactions.where("created_at > ?", 1.day.ago)
        expect(period_transactions.where(transaction_type: "expire").count).to eq(0)
        expect(period_transactions.where(transaction_type: "allocate").count).to eq(1)

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end

    it "absorbs debt from previous period" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(5000)  # Use all credits

      # Simulate going negative via transaction (e.g., pack credits exhausted)
      current = account.reload
      account.credit_transactions.create!(
        transaction_type: "consume",
        credit_type: "plan",
        reason: "ai_generation",
        amount: -1000,
        balance_after: -1000,
        plan_balance_after: -1000,
        pack_balance_after: 0,
        reference_type: "llm_run",
        reference_id: SecureRandom.uuid
      )

      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(4000)  # 5000 - 1000 debt
        expect(account.total_credits).to eq(4000)

        allocate_tx = account.credit_transactions.where(transaction_type: "allocate").last
        expect(allocate_tx.metadata["debt_absorbed"]).to eq(1000)
      end
    end
  end

  describe "plan upgrade" do
    it "gives full new plan credits immediately" do
      subscription = subscribe_to(starter_monthly)  # 2000 credits
      consume_credits(1000)  # Use half

      account.reload
      expect(account.plan_credits).to eq(1000)

      # Upgrade to Growth (5000 credits)
      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(5000)  # Full new allocation
      expect(account.total_credits).to eq(5000)

      # Should have: allocate (starter), consume, expire, allocate (growth)
      allocate_tx = account.credit_transactions.where(transaction_type: "allocate").last
      expect(allocate_tx.reason).to eq("plan_upgrade")
      expect(allocate_tx.amount).to eq(5000)
    end

    it "expires remaining credits before allocating new" do
      subscription = subscribe_to(starter_monthly)
      # Don't consume anything - full 2000 remaining

      change_plan(subscription, growth_monthly)

      expire_tx = account.credit_transactions.where(transaction_type: "expire").last
      expect(expire_tx).to be_present
      expect(expire_tx.amount).to eq(-2000)  # All starter credits expired

      account.reload
      expect(account.plan_credits).to eq(5000)
    end

    it "absorbs debt on upgrade" do
      subscription = subscribe_to(starter_monthly)
      consume_credits(2000)

      # Simulate going into debt via transaction
      current = account.reload
      account.credit_transactions.create!(
        transaction_type: "consume",
        credit_type: "plan",
        reason: "ai_generation",
        amount: -500,
        balance_after: -500,
        plan_balance_after: -500,
        pack_balance_after: 0,
        reference_type: "llm_run",
        reference_id: SecureRandom.uuid
      )

      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(4500)  # 5000 - 500 debt
    end
  end

  describe "plan downgrade" do
    it "pro-rates balance based on actual usage" do
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

      adjust_tx = account.credit_transactions.where(transaction_type: "adjust").last
      expect(adjust_tx.reason).to eq("plan_downgrade")
      expect(adjust_tx.metadata["usage_this_period"]).to eq(5000)
    end

    it "floors balance at zero - never creates debt from downgrade" do
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

    it "leaves credits if usage is less than new plan" do
      subscription = subscribe_to(pro_monthly)  # 15000 credits
      consume_credits(2000)  # Use only 2000

      # Downgrade to Growth (5000 credits)
      # Usage = 2000, new plan = 5000
      # Pro-rated balance = 5000 - 2000 = 3000
      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(3000)
    end
  end

  describe "yearly subscription monthly credit reset" do
    it "resets credits monthly on billing anchor day" do
      subscription = subscribe_to(growth_annual)
      consume_credits(3000)

      account.reload
      expect(account.plan_credits).to eq(2000)

      # Travel to next month's billing day
      billing_day = subscription.current_period_start.day
      next_reset = (Date.current + 1.month).change(day: [billing_day, (Date.current + 1.month).end_of_month.day].min)

      travel_to next_reset do
        Credits::DailyReconciliationWorker.new.perform

        # Worker enqueues async job, so we need to process it
        # In tests, perform_async is usually stubbed or we call perform directly
        account.payment_processor.subscription.tap do |sub|
          Credits::ReconcileOneAccountWorker.new.perform(account.id)
        end

        account.reload
        expect(account.plan_credits).to eq(5000)  # Fresh allocation
      end
    end

    it "handles anchor day greater than days in month (31st → Feb 28)" do
      # Create subscription starting Jan 31
      travel_to Date.new(2026, 1, 31) do
        subscription = subscribe_to(growth_annual)
        consume_credits(2000)
      end

      # February only has 28 days (2026 is not a leap year), should reset on Feb 28
      travel_to Date.new(2026, 2, 28) do
        Credits::DailyReconciliationWorker.new.perform
        Credits::ReconcileOneAccountWorker.new.perform(account.id)

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end

    it "does not reset monthly subscribers via daily reconciliation" do
      subscription = subscribe_to(growth_monthly)  # Monthly, not yearly
      consume_credits(2000)

      account.reload
      initial_credits = account.plan_credits

      # Daily reconciliation should not affect monthly subscribers
      Credits::DailyReconciliationWorker.new.perform

      account.reload
      expect(account.plan_credits).to eq(initial_credits)
    end
  end

  describe "pack credits preservation" do
    it "preserves pack credits across renewal" do
      subscription = subscribe_to(growth_monthly)

      # Add pack credits via proper transaction
      purchase_pack_credits(500)

      consume_credits(3000)

      travel 1.month do
        simulate_renewal(subscription)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(500)  # Preserved!
        expect(account.total_credits).to eq(5500)
      end
    end

    it "preserves pack credits across upgrade" do
      subscription = subscribe_to(starter_monthly)
      purchase_pack_credits(1000)

      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(1000)  # Preserved!
      expect(account.total_credits).to eq(6000)
    end

    it "preserves pack credits across downgrade" do
      subscription = subscribe_to(pro_monthly)
      purchase_pack_credits(500)
      consume_credits(5000)

      change_plan(subscription, growth_monthly)

      account.reload
      expect(account.pack_credits).to eq(500)  # Preserved!
    end
  end

  describe "idempotency and crash recovery" do
    it "handles crash between expire and allocate gracefully" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(1000)  # Leave 4000 remaining

      # Simulate first attempt that crashes after expire but before allocate
      # by manually creating just the expire transaction
      idempotency_key = "plan_credits:#{subscription.id}:#{(Time.current + 1.month).to_date.iso8601}"
      expire_key = idempotency_key.gsub("plan_credits:", "expire:")

      travel 1.month do
        # Manually create expire transaction (simulating partial completion)
        account.reload
        account.credit_transactions.create!(
          transaction_type: "expire",
          credit_type: "plan",
          reason: "plan_credits_expired",
          amount: -4000,
          balance_after: 0,
          plan_balance_after: 0,
          pack_balance_after: 0,
          reference_type: "Pay::Subscription",
          reference_id: subscription.id.to_s,
          idempotency_key: expire_key,
          metadata: {expired_credits: 4000}
        )

        # Update subscription period to trigger renewal
        simulate_renewal(subscription)

        # Verify only allocate is created, not another expire
        expect(account.credit_transactions.where(transaction_type: "expire").count).to eq(1)
        expect(account.credit_transactions.where(transaction_type: "allocate").count).to eq(2)

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end

    it "prevents double allocation with same idempotency key" do
      subscription = subscribe_to(growth_monthly)

      # Same idempotency key should not create another transaction
      idempotency_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"

      expect {
        Credits::AllocationService.new(account).reset_plan_credits!(
          subscription: subscription,
          idempotency_key: idempotency_key
        )
      }.not_to change { account.credit_transactions.count }
    end
  end

  describe "edge cases" do
    it "handles account with no prior transactions" do
      # Fresh account, no credit history
      subscription = subscribe_to(growth_monthly)

      expect(account.credit_transactions.count).to eq(1)
      expect(account.reload.plan_credits).to eq(5000)
    end

    it "handles subscription with inactive status" do
      subscription = subscribe_to(growth_monthly)
      initial_count = account.credit_transactions.count

      # Cancel subscription
      subscription.update!(status: "canceled")

      # Should not allocate credits to inactive subscription
      Credits::ResetPlanCreditsWorker.new.perform(subscription.id)

      expect(account.credit_transactions.count).to eq(initial_count)
    end

    # Note: Concurrent safety is ensured by database row locking in AllocationService
    # Thread-based tests don't work well with database transactions in test environment
    # The locking behavior is verified by the idempotency tests above
  end

  describe "transaction data integrity" do
    it "maintains balance consistency across all operations" do
      subscription = subscribe_to(growth_monthly)

      # Various operations
      consume_credits(1000)
      consume_credits(500)

      travel 1.month do
        simulate_renewal(subscription)
        consume_credits(2000)
      end

      # Verify all transactions have consistent balances
      account.credit_transactions.order(:created_at).each_cons(2) do |prev_tx, curr_tx|
        expected_balance = prev_tx.balance_after + curr_tx.amount
        expect(curr_tx.balance_after).to eq(expected_balance),
          "Balance mismatch: #{prev_tx.balance_after} + #{curr_tx.amount} should equal #{curr_tx.balance_after}"
      end
    end

    it "records correct metadata for audit trail" do
      subscription = subscribe_to(growth_monthly)

      allocate_tx = account.credit_transactions.last
      expect(allocate_tx.metadata["plan_tier"]).to eq("growth")
      expect(allocate_tx.metadata["credits_allocated"]).to eq(5000)
      expect(allocate_tx.reference_type).to eq("Pay::Subscription")
      expect(allocate_tx.reference_id).to eq(subscription.id.to_s)
    end
  end
end
