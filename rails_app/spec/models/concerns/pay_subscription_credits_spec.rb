# frozen_string_literal: true

require "rails_helper"

RSpec.describe PaySubscriptionCredits do
  let(:account) { create(:account) }
  let(:growth_tier) { create(:plan_tier, :growth) }
  let(:growth_plan) { create(:plan, :growth_monthly, plan_tier: growth_tier) }

  let(:payment_processor) do
    account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
      pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
    end
  end

  before do
    growth_plan.update!(fake_processor_id: growth_plan.name) unless growth_plan.fake_processor_id.present?
  end

  describe "after subscription created" do
    it "enqueues ResetPlanCreditsWorker when subscription is created" do
      expect(Credits::ResetPlanCreditsWorker).to receive(:perform_async).with(kind_of(Integer))

      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: growth_plan.fake_processor_id,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )
    end

    it "does not enqueue worker for inactive subscription" do
      expect(Credits::ResetPlanCreditsWorker).not_to receive(:perform_async)

      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: growth_plan.fake_processor_id,
        status: "canceled",
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )
    end
  end

  # Note: Renewals and plan changes are handled by webhook handlers, not callbacks.
  # See:
  #   - Credits::RenewalHandler (stripe.invoice.paid)
  #   - Credits::PlanChangeHandler (stripe.customer.subscription.updated)
  #   - spec/integration/credits/subscription_lifecycle_spec.rb for full lifecycle tests
end
