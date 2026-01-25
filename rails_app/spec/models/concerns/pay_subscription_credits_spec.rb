# frozen_string_literal: true

require "rails_helper"

RSpec.describe PaySubscriptionCredits do
  let(:account) { create(:account) }
  let(:growth_tier) { create(:plan_tier, :growth) }
  let(:starter_tier) { create(:plan_tier, :starter) }
  let(:growth_plan) { create(:plan, :growth_monthly, plan_tier: growth_tier) }
  let(:starter_plan) { create(:plan, :starter_monthly, plan_tier: starter_tier) }

  let(:payment_processor) do
    account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
      pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
    end
  end

  before do
    growth_plan.update!(fake_processor_id: growth_plan.name) unless growth_plan.fake_processor_id.present?
    starter_plan.update!(fake_processor_id: starter_plan.name) unless starter_plan.fake_processor_id.present?
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

    # Note: In this codebase, all payment processors are owned by Accounts
    # so we don't need to test the non-Account owner case
  end

  describe "after subscription updated" do
    let!(:subscription) do
      # Temporarily stub to avoid the create callback
      allow(Credits::ResetPlanCreditsWorker).to receive(:perform_async)

      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: growth_plan.fake_processor_id,
        status: "active",
        current_period_start: Time.current,
        current_period_end: 1.month.from_now
      )
    end

    context "on renewal (period change)" do
      it "enqueues worker when current_period_start changes" do
        expect(Credits::ResetPlanCreditsWorker).to receive(:perform_async)
          .with(subscription.id, previous_plan_id: nil)

        subscription.update!(
          current_period_start: 1.month.from_now,
          current_period_end: 2.months.from_now
        )
      end
    end

    context "on plan change" do
      it "enqueues worker with previous_plan_id when processor_plan changes" do
        expect(Credits::ResetPlanCreditsWorker).to receive(:perform_async)
          .with(subscription.id, previous_plan_id: growth_plan.id)

        subscription.update!(processor_plan: starter_plan.fake_processor_id)
      end

      it "looks up previous plan by fake_processor_id" do
        expect(Credits::ResetPlanCreditsWorker).to receive(:perform_async)
          .with(subscription.id, previous_plan_id: growth_plan.id)

        subscription.update!(processor_plan: starter_plan.fake_processor_id)
      end

      it "looks up previous plan by name if fake_processor_id not found" do
        # Remove the fake_processor_id to test name fallback
        growth_plan.update!(fake_processor_id: nil)
        subscription.update_column(:processor_plan, growth_plan.name)

        expect(Credits::ResetPlanCreditsWorker).to receive(:perform_async)
          .with(subscription.id, previous_plan_id: growth_plan.id)

        subscription.update!(processor_plan: starter_plan.fake_processor_id)
      end
    end

    context "on non-credit-related updates" do
      it "does not enqueue worker for status change alone" do
        expect(Credits::ResetPlanCreditsWorker).not_to receive(:perform_async)

        subscription.update!(name: "updated_name")
      end

      it "does not enqueue worker when subscription becomes inactive" do
        expect(Credits::ResetPlanCreditsWorker).not_to receive(:perform_async)

        subscription.update!(status: "canceled")
      end
    end
  end
end
