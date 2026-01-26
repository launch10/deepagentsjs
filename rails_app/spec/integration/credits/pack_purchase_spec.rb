# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Credit Pack Purchase", type: :integration do
  # Run Sidekiq jobs inline so credits are allocated synchronously
  around do |example|
    Sidekiq::Testing.inline! do
      example.run
    end
  end

  let(:account) { create(:account, :subscribed) }
  let(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999, name: "Starter Pack") }

  let(:payment_processor) { account.payment_processor }

  describe "charge with credit_pack_id in metadata triggers pack allocation" do
    it "allocates pack credits when charge is created with credit_pack_id metadata" do
      # Reload to get current credits after subscription allocation
      account.reload
      initial_pack_credits = account.pack_credits
      initial_total_credits = account.total_credits
      expect(initial_pack_credits).to eq(0)

      # Create a charge with credit_pack_id in metadata
      # This triggers ChargeExtensions.handle_credit_pack_purchase callback
      charge = payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(initial_pack_credits + 1000)
      expect(account.total_credits).to eq(initial_total_credits + 1000)
    end

    it "creates CreditPackPurchase linked to charge" do
      charge = payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      purchase = CreditPackPurchase.last
      expect(purchase).to be_present
      expect(purchase.account).to eq(account)
      expect(purchase.credit_pack).to eq(credit_pack)
      expect(purchase.pay_charge).to eq(charge)
      expect(purchase.credits_purchased).to eq(1000)
      expect(purchase.price_cents).to eq(4999)
    end

    it "creates CreditTransaction with purchase type" do
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      transaction = account.credit_transactions.last
      expect(transaction.transaction_type).to eq("purchase")
      expect(transaction.credit_type).to eq("pack")
      expect(transaction.reason).to eq("pack_purchase")
      expect(transaction.amount).to eq(1000)
    end
  end

  describe "idempotency" do
    it "is idempotent - duplicate worker calls do not double-allocate" do
      # Reload to get current state after subscription allocation
      account.reload
      initial_transaction_count = account.credit_transactions.count
      initial_pack_credits = account.pack_credits

      charge = payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(initial_pack_credits + 1000)
      expect(account.credit_transactions.count).to eq(initial_transaction_count + 1)
      expect(CreditPackPurchase.where(account: account).count).to eq(1)
      expect(CreditPackPurchase.last.credits_allocated).to be true

      # Manually call worker again (simulating duplicate webhook/event)
      Credits::AllocatePackCreditsWorker.new.perform(charge.id, credit_pack.id)

      account.reload
      expect(account.pack_credits).to eq(initial_pack_credits + 1000) # Still only +1000
      expect(account.credit_transactions.count).to eq(initial_transaction_count + 1) # No new transaction
      expect(CreditPackPurchase.where(account: account).count).to eq(1) # No new purchase
    end
  end

  describe "preserves pack credits across subscription operations" do
    let(:plan_tier) { create(:plan_tier, :growth) } # 5000 credits
    let(:plan) { create(:plan, :growth_monthly, plan_tier: plan_tier) }
    let(:subscription) { account.subscriptions.active.first }

    before do
      # Update existing subscription to use our plan with growth tier
      plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?
      subscription.update!(processor_plan: plan.fake_processor_id)
      allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)
    end

    it "preserves pack credits across subscription renewal" do
      # First, buy pack credits (subscription already exists from :subscribed trait)
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(1000)

      # Allocate plan credits to simulate initial subscription credit allocation
      idempotency_key = "plan_credits:#{subscription.id}:#{Time.current.to_date.iso8601}"
      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key
      )

      account.reload
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(1000) # Preserved!
      expect(account.total_credits).to eq(6000)

      # Simulate renewal in a NEW billing period
      # First, update subscription period to simulate time passing
      subscription.update!(
        current_period_start: 1.month.from_now,
        current_period_end: 2.months.from_now
      )

      # Reset plan credits for the new period
      renewal_key = "plan_credits:#{subscription.id}:#{1.month.from_now.to_date.iso8601}"
      Credits::AllocationService.new(account).reset_plan_credits!(
        subscription: subscription,
        idempotency_key: renewal_key
      )

      account.reload
      expect(account.plan_credits).to eq(5000) # Fresh plan allocation
      expect(account.pack_credits).to eq(1000) # Still preserved!
      expect(account.total_credits).to eq(6000)
    end
  end

  describe "charge without credit_pack_id" do
    it "does not allocate credits for regular charges" do
      expect(account.pack_credits).to eq(0)

      # Regular charge without credit_pack_id
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: 9999,
        amount_refunded: 0,
        metadata: {}
      )

      account.reload
      expect(account.pack_credits).to eq(0)
      expect(CreditPackPurchase.count).to eq(0)
    end
  end

  describe "multiple pack purchases" do
    let(:large_pack) { create(:credit_pack, credits: 5000, price_cents: 19999, name: "Large Pack") }

    it "accumulates credits from multiple purchases" do
      # First purchase
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(1000)

      # Second purchase (different pack)
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: large_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => large_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(6000)
      expect(CreditPackPurchase.count).to eq(2)
    end
  end

  describe "subscription requirement" do
    let(:unsubscribed_account) { create(:account) }

    let(:unsubscribed_payment_processor) do
      unsubscribed_account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
        pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
      end
    end

    it "rejects pack purchase when account has no active subscription" do
      expect(unsubscribed_account.subscriptions.active).not_to exist

      # Create a charge with credit_pack_id in metadata
      # The worker will fail because account has no active subscription
      expect {
        unsubscribed_payment_processor.charges.create!(
          processor_id: "ch_#{SecureRandom.hex(8)}",
          amount: credit_pack.price_cents,
          amount_refunded: 0,
          metadata: {"credit_pack_id" => credit_pack.id}
        )
      }.to raise_error(ActiveRecord::RecordInvalid, /Account must have an active subscription/)

      # No credits should be allocated
      unsubscribed_account.reload
      expect(unsubscribed_account.pack_credits).to eq(0)
      expect(CreditPackPurchase.where(account: unsubscribed_account).count).to eq(0)
    end

    it "allows pack purchase when account has active subscription" do
      expect(account.subscriptions.active).to exist
      initial_pack_credits = account.pack_credits

      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(initial_pack_credits + 1000)
      expect(CreditPackPurchase.where(account: account).count).to eq(1)
    end
  end
end
