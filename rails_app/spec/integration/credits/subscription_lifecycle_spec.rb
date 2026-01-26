# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Subscription Credit Lifecycle", type: :integration do
  include ActiveSupport::Testing::TimeHelpers
  include StripeWebhookFixtures

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

  # Plans with Stripe IDs for webhook lookup
  let(:starter_monthly) do
    create(:plan, :starter_monthly, plan_tier: starter_tier, stripe_id: "price_starter_monthly")
  end
  let(:growth_monthly) do
    create(:plan, :growth_monthly, plan_tier: growth_tier, stripe_id: "price_growth_monthly")
  end
  let(:growth_annual) do
    create(:plan, :growth_annual, plan_tier: growth_tier, stripe_id: "price_growth_annual")
  end
  let(:pro_monthly) do
    create(:plan, :pro_monthly, plan_tier: pro_tier, stripe_id: "price_pro_monthly")
  end

  before do
    # Ensure plans have processor IDs for lookup
    [starter_monthly, growth_monthly, growth_annual, pro_monthly].each do |plan|
      plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?
    end
  end

  # Helper to process webhook through our handlers directly
  # We call our handlers directly instead of using Pay::Webhooks.instrument
  # to avoid triggering Pay's built-in handlers which try to sync from Stripe
  def process_webhook(event)
    case event.type
    when "stripe.invoice.paid"
      Credits::RenewalHandler.new.call(event)
    when "stripe.customer.subscription.updated"
      Credits::PlanChangeHandler.new.call(event)
    else
      # For events we don't handle, use Pay's instrument (may trigger Stripe sync)
      Pay::Webhooks.instrument(event: event, type: event.type)
    end
  end

  # Helper to create a Stripe-like subscription
  def subscribe_to(plan)
    processor = account.set_payment_processor(:stripe, allow_fake: true)
    processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}") unless processor.processor_id

    processor.subscriptions.create!(
      processor_id: "sub_#{SecureRandom.hex(8)}",
      name: "default",
      processor_plan: plan.stripe_id,
      status: "active",
      current_period_start: Time.current,
      current_period_end: plan.yearly? ? 1.year.from_now : 1.month.from_now
    )
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

  # Helper to advance subscription billing period.
  #
  # In tests, we manually update the subscription to simulate what Pay does
  # when it processes the subscription.updated webhook from Stripe.
  #
  # NOTE: In production, webhook delivery order is NOT guaranteed by Stripe.
  # Our handlers are designed to work regardless of whether subscription.updated
  # or invoice.paid arrives first. See: https://docs.stripe.com/webhooks
  def advance_billing_period(subscription)
    old_period_end = subscription.current_period_end
    subscription.update!(
      current_period_start: old_period_end,
      current_period_end: old_period_end + 1.month
    )
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
      pro_processor = pro_account.set_payment_processor(:stripe, allow_fake: true)
      pro_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
      pro_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: pro_monthly.stripe_id,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )

      pro_account.reload
      expect(pro_account.plan_credits).to eq(15000)  # Pro tier
    end
  end

  describe "monthly subscription renewal via invoice.paid webhook" do
    it "expires unused credits and allocates fresh credits on renewal" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(1000)  # Use 1000 of 5000

      account.reload
      expect(account.plan_credits).to eq(4000)

      # Simulate renewal via invoice.paid webhook with subscription_cycle billing_reason
      travel 1.month do
        # In real Stripe flow, subscription period is updated before invoice.paid fires
        advance_billing_period(subscription)

        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"  # This is the authoritative signal for renewal
        )

        process_webhook(event)

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

    it "does not allocate credits for proration invoices (billing_reason: subscription_update)" do
      subscription = subscribe_to(growth_monthly)
      initial_credits = account.reload.plan_credits

      # Proration invoice should NOT trigger credit allocation
      event = invoice_paid_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        billing_reason: "subscription_update"  # Proration from plan change
      )

      process_webhook(event)

      # Credits unchanged - proration doesn't reset credits
      expect(account.reload.plan_credits).to eq(initial_credits)
    end

    it "does not create expire transaction when no credits remain" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(5000)  # Use all credits

      account.reload
      expect(account.plan_credits).to eq(0)

      travel 1.month do
        advance_billing_period(subscription)

        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )

        process_webhook(event)

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
      account.reload
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
        advance_billing_period(subscription)

        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )

        process_webhook(event)

        account.reload
        expect(account.plan_credits).to eq(4000)  # 5000 - 1000 debt
        expect(account.total_credits).to eq(4000)

        allocate_tx = account.credit_transactions.where(transaction_type: "allocate").last
        expect(allocate_tx.metadata["debt_absorbed"]).to eq(1000)
      end
    end
  end

  describe "plan upgrade via subscription.updated webhook" do
    it "gives full new plan credits immediately" do
      subscription = subscribe_to(starter_monthly)  # 2000 credits
      consume_credits(1000)  # Use half

      account.reload
      expect(account.plan_credits).to eq(1000)

      # Upgrade via subscription.updated webhook with previous_attributes.items
      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: starter_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: starter_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      # Update the subscription record to reflect the new plan
      # (In production, Pay's SubscriptionUpdated handler does this)
      subscription.update!(processor_plan: growth_monthly.stripe_id)

      process_webhook(event)

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

      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: starter_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: starter_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

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
      account.reload
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

      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: starter_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: starter_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

      account.reload
      expect(account.plan_credits).to eq(4500)  # 5000 - 500 debt
    end
  end

  describe "plan downgrade via subscription.updated webhook" do
    it "pro-rates balance based on actual usage" do
      subscription = subscribe_to(pro_monthly)  # 15000 credits
      consume_credits(5000)  # Use 5000

      account.reload
      expect(account.plan_credits).to eq(10000)

      # Downgrade to Growth (5000 credits)
      # Usage = 5000, new plan = 5000
      # Pro-rated balance = 5000 - 5000 = 0
      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: pro_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: pro_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

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
      # Pro-rated = 5000 - 10000 = -5000 -> floored to 0
      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: pro_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: pro_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

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
      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: pro_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: pro_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

      account.reload
      expect(account.plan_credits).to eq(3000)
    end
  end

  describe "non-credit subscription events are ignored" do
    it "does not allocate credits for quantity changes" do
      subscription = subscribe_to(growth_monthly)
      initial_credits = account.reload.plan_credits
      initial_count = account.credit_transactions.count

      event = subscription_quantity_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        price_id: growth_monthly.stripe_id,
        old_quantity: 1,
        new_quantity: 5
      )

      process_webhook(event)

      expect(account.reload.plan_credits).to eq(initial_credits)
      expect(account.credit_transactions.count).to eq(initial_count)
    end

    it "does not allocate credits for metadata changes" do
      subscription = subscribe_to(growth_monthly)
      initial_credits = account.reload.plan_credits
      initial_count = account.credit_transactions.count

      event = subscription_metadata_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_metadata: {"account_id" => "123"},
        new_metadata: {"account_id" => "123", "internal_note" => "VIP"}
      )

      process_webhook(event)

      expect(account.reload.plan_credits).to eq(initial_credits)
      expect(account.credit_transactions.count).to eq(initial_count)
    end

    it "does not allocate credits for payment method changes" do
      subscription = subscribe_to(growth_monthly)
      initial_credits = account.reload.plan_credits
      initial_count = account.credit_transactions.count

      event = subscription_payment_method_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_payment_method_id: "pm_old_card",
        new_payment_method_id: "pm_new_card"
      )

      process_webhook(event)

      expect(account.reload.plan_credits).to eq(initial_credits)
      expect(account.credit_transactions.count).to eq(initial_count)
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
        # DailyReconciliationWorker calls ResetPlanCreditsWorker.perform_async
        # which runs inline due to Sidekiq::Testing.inline!
        Credits::DailyReconciliationWorker.new.perform

        account.reload
        expect(account.plan_credits).to eq(5000)  # Fresh allocation
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
        advance_billing_period(subscription)

        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )

        process_webhook(event)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(500)  # Preserved!
        expect(account.total_credits).to eq(5500)
      end
    end

    it "preserves pack credits across upgrade" do
      subscription = subscribe_to(starter_monthly)
      purchase_pack_credits(1000)

      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: starter_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: starter_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

      account.reload
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(1000)  # Preserved!
      expect(account.total_credits).to eq(6000)
    end

    it "preserves pack credits across downgrade" do
      subscription = subscribe_to(pro_monthly)
      purchase_pack_credits(500)
      consume_credits(5000)

      event = subscription_plan_changed_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        old_price_id: pro_monthly.stripe_id,
        new_price_id: growth_monthly.stripe_id,
        old_unit_amount: pro_monthly.amount,
        new_unit_amount: growth_monthly.amount
      )

      subscription.update!(processor_plan: growth_monthly.stripe_id)
      process_webhook(event)

      account.reload
      expect(account.pack_credits).to eq(500)  # Preserved!
    end
  end

  describe "idempotency and crash recovery" do
    it "handles duplicate invoice.paid events (same event ID)" do
      subscription = subscribe_to(growth_monthly)
      consume_credits(1000)

      travel 1.month do
        advance_billing_period(subscription)

        # Same event ID should be idempotent
        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )

        # Process same event twice
        process_webhook(event)
        initial_count = account.credit_transactions.count

        process_webhook(event)

        # Should not create duplicate transactions
        expect(account.credit_transactions.count).to eq(initial_count)
      end
    end

    it "handles out-of-order webhook delivery" do
      subscription = subscribe_to(growth_monthly)

      travel 1.month do
        advance_billing_period(subscription)

        # subscription.updated arrives before invoice.paid
        # (can happen with webhook delivery timing)
        period_event = subscription_renewed_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          old_period_start: 1.month.ago,
          old_period_end: Time.current,
          new_period_start: Time.current,
          new_period_end: 1.month.from_now
        )

        invoice_event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )

        # Process in "wrong" order - period update first
        process_webhook(period_event)
        # Period event with no items change should be ignored by PlanChangeHandler
        expect(account.credit_transactions.where(transaction_type: "allocate").count).to eq(1)

        # Then invoice arrives
        process_webhook(invoice_event)
        # NOW credits should be allocated
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

      # Webhook for canceled subscription should not allocate credits
      event = invoice_paid_event(
        subscription_id: subscription.processor_id,
        customer_id: subscription.customer.processor_id,
        billing_reason: "subscription_cycle"
      )

      process_webhook(event)

      expect(account.credit_transactions.count).to eq(initial_count)
    end

    it "ignores webhooks for unknown subscriptions" do
      # No subscription exists for this ID
      event = invoice_paid_event(
        subscription_id: "sub_does_not_exist",
        customer_id: "cus_unknown",
        billing_reason: "subscription_cycle"
      )

      expect { process_webhook(event) }.not_to raise_error
    end

  end

  describe "transaction data integrity" do
    it "maintains balance consistency across all operations" do
      subscription = subscribe_to(growth_monthly)

      # Various operations
      consume_credits(1000)
      consume_credits(500)

      travel 1.month do
        advance_billing_period(subscription)

        event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )
        process_webhook(event)

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

  describe "full subscription lifecycle" do
    it "handles create -> use -> renew -> upgrade -> cancel" do
      # 1. Create subscription (initial allocation via callback)
      subscription = subscribe_to(starter_monthly)
      expect(account.reload.plan_credits).to eq(2000)

      # 2. User consumes credits
      consume_credits(1500)
      expect(account.reload.plan_credits).to eq(500)

      # 3. Month passes, renewal via webhook
      travel 1.month do
        advance_billing_period(subscription)

        renewal_event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_cycle"
        )
        process_webhook(renewal_event)
        expect(account.reload.plan_credits).to eq(2000)  # Fresh allocation

        # 4. User upgrades mid-cycle via webhook
        upgrade_event = subscription_plan_changed_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          old_price_id: starter_monthly.stripe_id,
          new_price_id: growth_monthly.stripe_id,
          old_unit_amount: starter_monthly.amount,
          new_unit_amount: growth_monthly.amount
        )
        subscription.update!(processor_plan: growth_monthly.stripe_id)
        process_webhook(upgrade_event)
        expect(account.reload.plan_credits).to eq(5000)  # Full upgrade

        # 5. Proration invoice (should NOT reset credits)
        proration_event = invoice_paid_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          billing_reason: "subscription_update"
        )
        process_webhook(proration_event)
        expect(account.reload.plan_credits).to eq(5000)  # Unchanged

        # 6. User schedules cancellation
        cancel_event = subscription_cancel_scheduled_event(
          subscription_id: subscription.processor_id,
          customer_id: subscription.customer.processor_id,
          cancel_at: 1.month.from_now
        )
        process_webhook(cancel_event)
        expect(account.reload.plan_credits).to eq(5000)  # Keeps credits until end
      end
    end
  end
end
