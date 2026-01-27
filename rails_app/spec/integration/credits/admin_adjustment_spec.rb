# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Admin Credit Adjustment", type: :integration do
  let(:account) { create(:account) }
  let(:admin) { create(:user, admin: true) }
  let(:service) { Credits::AllocationService.new(account) }

  describe "admin can adjust credits to specific values" do
    it "sets credits from zero" do
      expect(account.total_millicredits).to eq(0)

      service.adjust_credits!(
        plan_millicredits: 5_000_000,
        pack_millicredits: 1_000_000,
        reason: "admin_adjustment",
        admin: admin,
        notes: "Initial setup"
      )

      account.reload
      expect(account.plan_millicredits).to eq(5_000_000)
      expect(account.pack_millicredits).to eq(1_000_000)
      expect(account.total_millicredits).to eq(6_000_000)
    end

    it "reduces credits for testing exhaustion" do
      # Start with credits
      service.adjust_credits!(
        plan_millicredits: 5_000_000,
        pack_millicredits: 0,
        reason: "initial_setup",
        admin: admin
      )

      account.reload
      expect(account.plan_millicredits).to eq(5_000_000)

      # Reduce to near-zero for exhaustion testing
      service.adjust_credits!(
        plan_millicredits: 1,
        pack_millicredits: 0,
        reason: "e2e_test_setup",
        admin: admin,
        notes: "Testing credit exhaustion"
      )

      account.reload
      expect(account.plan_millicredits).to eq(1)
      expect(account.total_millicredits).to eq(1)
    end

    it "creates proper audit trail" do
      service.adjust_credits!(
        plan_millicredits: 5_000_000,
        pack_millicredits: 0,
        reason: "admin_adjustment",
        admin: admin,
        notes: "Customer compensation"
      )

      tx = CreditTransaction.last
      expect(tx.transaction_type).to eq("adjust")
      expect(tx.reason).to eq("admin_adjustment")
      expect(tx.metadata["admin_id"]).to eq(admin.id)
      expect(tx.metadata["admin_email"]).to eq(admin.email)
      expect(tx.metadata["notes"]).to eq("Customer compensation")
    end
  end

  describe "adjusted credits persist across plan operations" do
    let(:plan_tier) { create(:plan_tier, :growth) } # 5000 credits
    let(:plan) { create(:plan, :growth_monthly, plan_tier: plan_tier) }

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

    before do
      allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)
    end

    it "admin adjustment persists when subscription renews" do
      # Create subscription and allocate plan credits
      sub = subscription
      period_start = sub.current_period_start.to_date
      service.reset_plan_credits!(
        subscription: sub,
        idempotency_key: "plan_credits:#{sub.id}:#{period_start.iso8601}"
      )

      account.reload
      expect(account.plan_credits).to eq(5000)

      # Admin adds pack credits via adjustment
      service.adjust_credits!(
        plan_millicredits: account.plan_millicredits,
        pack_millicredits: 500_000,
        reason: "promotional_bonus",
        admin: admin
      )

      account.reload
      expect(account.pack_millicredits).to eq(500_000)

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
      expect(account.pack_millicredits).to eq(500_000) # Pack credits preserved!
    end
  end
end
