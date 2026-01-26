# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::ResetPlanCreditsWorker do
  let(:account) { create(:account) }
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

  let(:worker) { described_class.new }

  before do
    # Stub the plan method on subscription to return our plan
    allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)
  end

  describe "#perform" do
    it "allocates credits for a new subscription" do
      expect {
        worker.perform(subscription.id)
      }.to change { CreditTransaction.count }.by(1)

      transaction = CreditTransaction.last
      expect(transaction.transaction_type).to eq("allocate")
      expect(transaction.reason).to eq("plan_renewal")
      expect(transaction.amount).to eq(5000)

      account.reload
      expect(account.total_credits).to eq(5000)
    end

    it "generates correct idempotency key format" do
      worker.perform(subscription.id)

      transaction = CreditTransaction.last
      expected_key = "plan_credits:#{subscription.id}:#{subscription.current_period_start.to_date.iso8601}"
      expect(transaction.idempotency_key).to eq(expected_key)
    end

    it "is idempotent - second call does nothing" do
      worker.perform(subscription.id)
      expect(CreditTransaction.count).to eq(1)

      expect {
        worker.perform(subscription.id)
      }.not_to change { CreditTransaction.count }
    end

    it "skips if subscription is not active" do
      subscription.update!(status: "canceled")

      expect {
        worker.perform(subscription.id)
      }.not_to change { CreditTransaction.count }
    end

    it "handles subscription not found gracefully" do
      expect {
        worker.perform(999_999)
      }.to raise_error(ActiveRecord::RecordNotFound)
    end

    context "with existing credits (renewal)" do
      before do
        # Set up with millicredits (3000 credits = 3_000_000 millicredits)
        account.update!(plan_millicredits: 3_000_000, pack_millicredits: 0, total_millicredits: 3_000_000)
      end

      it "expires old credits and allocates new" do
        expect {
          worker.perform(subscription.id)
        }.to change { CreditTransaction.count }.by(2)

        expire_tx = CreditTransaction.where(transaction_type: "expire").last
        allocate_tx = CreditTransaction.where(transaction_type: "allocate").last

        expect(expire_tx.reason).to eq("plan_credits_expired")
        expect(allocate_tx.reason).to eq("plan_renewal")

        account.reload
        expect(account.total_credits).to eq(5000)
      end
    end
  end
end
