# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::AdjustUsageCreditsWorker, type: :worker do
  let(:account) { create(:account) }
  let(:admin) { create(:user, admin: true) }
  let(:adjustment) { create(:credit_usage_adjustment, account: account, admin: admin, amount: 50) }

  before do
    # Give the account some credits to consume
    Credits::AllocationService.new(account).adjust_credits!(
      plan_millicredits: 100_000,
      pack_millicredits: 0,
      reason: "initial_setup",
      admin: admin
    )
    account.reload
  end

  describe "#perform" do
    it "adjusts usage credits for the account" do
      expect(account.plan_millicredits).to eq(100_000)

      described_class.new.perform(adjustment.id)

      account.reload
      adjustment.reload

      # 50 credits = 50,000 millicredits consumed
      expect(account.plan_millicredits).to eq(50_000)
      expect(adjustment.credits_adjusted).to be true
    end

    it "creates a consume transaction" do
      expect {
        described_class.new.perform(adjustment.id)
      }.to change(CreditTransaction, :count).by(1)

      tx = CreditTransaction.last
      expect(tx.transaction_type).to eq("consume")
      expect(tx.reason).to eq("billing_correction")
      expect(tx.amount_millicredits).to eq(-50_000)
      expect(tx.metadata["admin_id"]).to eq(admin.id)
    end

    it "is idempotent - does not re-adjust if already adjusted" do
      described_class.new.perform(adjustment.id)
      account.reload
      balance_after_first = account.plan_millicredits

      # Run again
      described_class.new.perform(adjustment.id)
      account.reload

      expect(account.plan_millicredits).to eq(balance_after_first)
      expect(CreditTransaction.where(idempotency_key: "usage_adjustment:#{adjustment.id}").count).to eq(1)
    end

    it "skips if adjustment was already processed" do
      adjustment.update!(credits_adjusted: true)

      expect {
        described_class.new.perform(adjustment.id)
      }.not_to change(CreditTransaction, :count)
    end
  end
end
