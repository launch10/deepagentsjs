# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Admin Gift Credits", type: :integration do
  let(:account) { create(:account) }
  let(:admin) { create(:user, admin: true) }

  # Helper to create a gift - allocation happens async via worker
  def create_gift(attrs = {})
    account.credit_gifts.create!(
      admin: admin,
      amount: attrs[:amount] || 500,
      reason: attrs[:reason] || "customer_support",
      notes: attrs[:notes]
    )
  end

  describe "admin can gift credits to account" do
    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    it "creates CreditGift record with admin, amount, reason" do
      expect {
        create_gift(
          amount: 500,
          reason: "customer_support",
          notes: "Compensation for outage"
        )
      }.to change { CreditGift.count }.by(1)

      gift = CreditGift.last
      expect(gift.account).to eq(account)
      expect(gift.admin).to eq(admin)
      expect(gift.amount).to eq(500)
      expect(gift.reason).to eq("customer_support")
      expect(gift.notes).to eq("Compensation for outage")
    end

    it "creates CreditTransaction with type: gift, credit_type: pack via async worker" do
      create_gift(amount: 500, reason: "promotional")

      transaction = account.credit_transactions.last
      expect(transaction.transaction_type).to eq("gift")
      expect(transaction.credit_type).to eq("pack")
      expect(transaction.reason).to eq("gift")
      expect(transaction.amount).to eq(500)
    end

    it "increases account.pack_credits by gift amount" do
      expect(account.pack_credits).to eq(0)

      create_gift(amount: 500, reason: "beta_testing")

      account.reload
      expect(account.pack_credits).to eq(500)
      expect(account.total_credits).to eq(500)
    end

    it "records admin_id and admin_email in transaction metadata" do
      create_gift(amount: 500, reason: "referral_bonus")

      transaction = account.credit_transactions.last
      expect(transaction.metadata["admin_id"]).to eq(admin.id)
      expect(transaction.metadata["admin_email"]).to eq(admin.email)
      expect(transaction.metadata["gift_reason"]).to eq("referral_bonus")
    end

    it "marks credits_allocated: true after worker completes" do
      gift = create_gift(amount: 500, reason: "promotional")

      expect(gift.reload.credits_allocated).to eq(true)
    end
  end

  describe "gifted credits are preserved across plan operations" do
    let(:plan_tier) { create(:plan_tier, :growth) } # 5000 credits
    let(:plan) { create(:plan, :growth_monthly, plan_tier: plan_tier) }
    let(:service) { Credits::AllocationService.new(account) }

    let(:payment_processor) do
      account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
        pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
      end
    end

    let(:subscription) do
      plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?

      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: plan.fake_processor_id || plan.name,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )
    end

    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    before do
      allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)
    end

    it "gift credits persist through subscription creation" do
      # Gift credits first (worker runs inline)
      create_gift(amount: 300, reason: "promotional")
      account.reload
      expect(account.pack_credits).to eq(300)

      # Create subscription (triggers plan credit allocation)
      _ = subscription

      account.reload
      expect(account.plan_credits).to eq(5000)
      expect(account.pack_credits).to eq(300) # Preserved!
      expect(account.total_credits).to eq(5300)
    end

    it "gift credits persist through subscription renewal" do
      # Create subscription first
      _ = subscription
      account.reload
      expect(account.plan_credits).to eq(5000)

      # Gift credits (worker runs inline)
      create_gift(amount: 300, reason: "compensation")
      account.reload
      expect(account.pack_credits).to eq(300)

      # Simulate renewal in a NEW billing period
      subscription.update!(
        current_period_start: 1.month.from_now,
        current_period_end: 2.months.from_now
      )

      idempotency_key = "plan_credits:#{subscription.id}:#{1.month.from_now.to_date.iso8601}"
      service.reset_plan_credits!(
        subscription: subscription,
        idempotency_key: idempotency_key
      )

      account.reload
      expect(account.plan_credits).to eq(5000) # Fresh plan allocation
      expect(account.pack_credits).to eq(300) # Still preserved!
      expect(account.total_credits).to eq(5300)
    end
  end

  describe "all valid gift reasons" do
    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    CreditGift::REASONS.each do |reason|
      it "accepts reason: #{reason}" do
        expect {
          create_gift(amount: 100, reason: reason)
        }.to change { account.reload.pack_credits }.by(100)
      end
    end
  end

  describe "invalid gift parameters" do
    it "rejects negative amount" do
      expect {
        create_gift(amount: -100, reason: "other")
      }.to raise_error(ActiveRecord::RecordInvalid, /Amount must be greater than 0/)
    end

    it "rejects zero amount" do
      expect {
        create_gift(amount: 0, reason: "other")
      }.to raise_error(ActiveRecord::RecordInvalid, /Amount must be greater than 0/)
    end

    it "rejects invalid reason" do
      expect {
        create_gift(amount: 100, reason: "invalid_reason")
      }.to raise_error(ActiveRecord::RecordInvalid, /Reason is not included/)
    end
  end

  describe "multiple gifts to same account" do
    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    it "accumulates gift credits" do
      create_gift(amount: 200, reason: "customer_support")
      create_gift(amount: 300, reason: "promotional")
      create_gift(amount: 500, reason: "beta_testing")

      account.reload
      expect(account.pack_credits).to eq(1000)
      expect(CreditGift.count).to eq(3)
      expect(CreditTransaction.where(transaction_type: "gift").count).to eq(3)
    end
  end

  describe "combined pack purchases and gifts" do
    let(:credit_pack) { create(:credit_pack, credits: 1000, price_cents: 4999) }
    let(:plan_tier) { create(:plan_tier, :growth) }
    let(:plan) { create(:plan, :growth_monthly, plan_tier: plan_tier) }

    let(:payment_processor) do
      account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
        pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
      end
    end

    around do |example|
      Sidekiq::Testing.inline! do
        example.run
      end
    end

    before do
      # Pack purchases require an active subscription
      plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?
      allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)

      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: plan.fake_processor_id || plan.name,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )
    end

    it "combines pack credits and gift credits" do
      # Account has plan credits from subscription (5000)
      account.reload
      initial_plan_credits = account.plan_credits

      # Purchase pack
      payment_processor.charges.create!(
        processor_id: "ch_#{SecureRandom.hex(8)}",
        amount: credit_pack.price_cents,
        amount_refunded: 0,
        metadata: {"credit_pack_id" => credit_pack.id}
      )

      account.reload
      expect(account.pack_credits).to eq(1000)

      # Gift credits (worker runs inline)
      create_gift(amount: 500, reason: "promotional")

      account.reload
      expect(account.pack_credits).to eq(1500) # 1000 + 500
      expect(account.total_credits).to eq(initial_plan_credits + 1500)
    end
  end
end
