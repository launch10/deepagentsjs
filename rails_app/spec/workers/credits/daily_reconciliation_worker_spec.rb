# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::DailyReconciliationWorker do
  include ActiveSupport::Testing::TimeHelpers

  let(:worker) { described_class.new }

  describe "#perform" do
    let(:plan_tier) { create(:plan_tier, :growth) } # 5000 credits
    let(:yearly_plan) { create(:plan, :growth_annual, plan_tier: plan_tier) }
    let(:monthly_plan) { create(:plan, :growth_monthly, plan_tier: plan_tier) }

    before do
      yearly_plan.update!(fake_processor_id: yearly_plan.name) unless yearly_plan.fake_processor_id.present?
      monthly_plan.update!(fake_processor_id: monthly_plan.name) unless monthly_plan.fake_processor_id.present?
    end

    def create_yearly_subscription(account:, billing_day:)
      payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
      payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

      # Set subscription start date with the specified billing day
      start_date = Date.current.beginning_of_month + (billing_day - 1).days
      start_date = start_date.prev_month if start_date > Date.current

      subscription = payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: yearly_plan.fake_processor_id,
        status: "active",
        current_period_start: start_date.to_time,
        current_period_end: (start_date + 1.year).to_time
      )

      allow(subscription).to receive(:plan).and_return(yearly_plan)
      subscription
    end

    context "Scenario 11: Yearly subscriber - normal reset on billing anchor day" do
      it "resets credits on the billing anchor day (e.g., 15th)" do
        # Create account that subscribed on the 15th
        account = create(:account)
        subscription = create_yearly_subscription(account: account, billing_day: 15)

        # Set up some existing credits
        account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000)

        # Travel to the 15th of the current month
        travel_to Date.current.beginning_of_month + 14.days do
          # Stub plan method for all subscriptions
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.to change { CreditTransaction.count }

          account.reload
          expect(account.plan_credits).to eq(5000)
        end
      end

      it "does not reset credits on non-billing days" do
        account = create(:account)
        subscription = create_yearly_subscription(account: account, billing_day: 15)
        account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000)

        # Travel to the 10th (not the billing day)
        travel_to Date.current.beginning_of_month + 9.days do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.not_to change { CreditTransaction.count }

          account.reload
          expect(account.plan_credits).to eq(3000) # Unchanged
        end
      end
    end

    context "Scenario 12: Yearly subscriber - anchor day > days in month" do
      it "resets on last day of month when anchor day exceeds month days (e.g., 31st -> Feb 28)" do
        account = create(:account)

        # Create subscription that started on the 31st of a month
        payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
        payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

        # January 31st start date
        start_date = Date.new(Date.current.year, 1, 31)
        subscription = payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: yearly_plan.fake_processor_id,
          status: "active",
          current_period_start: start_date.to_time,
          current_period_end: (start_date + 1.year).to_time
        )

        account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000)

        # Travel to February 28th (last day of Feb in non-leap year)
        # In a leap year, this would be Feb 29th
        feb_last_day = Date.new(Date.current.year, 2, 1).end_of_month

        travel_to feb_last_day do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.to change { CreditTransaction.count }

          account.reload
          expect(account.plan_credits).to eq(5000)
        end
      end
    end

    context "monthly subscribers" do
      it "does not process monthly subscribers" do
        account = create(:account)
        payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
        payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

        subscription = payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: monthly_plan.fake_processor_id,
          status: "active",
          current_period_start: Date.current.beginning_of_month.to_time,
          current_period_end: (Date.current.beginning_of_month + 1.month).to_time
        )

        account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000)

        allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(monthly_plan)

        expect {
          worker.perform
        }.not_to change { CreditTransaction.count }
      end
    end

    context "idempotency" do
      it "does not double-allocate if already processed this month" do
        account = create(:account)
        subscription = create_yearly_subscription(account: account, billing_day: 15)

        travel_to Date.current.beginning_of_month + 14.days do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          # First run
          worker.perform
          initial_credits = account.reload.plan_credits

          # Second run on same day
          expect {
            worker.perform
          }.not_to change { CreditTransaction.count }

          expect(account.reload.plan_credits).to eq(initial_credits)
        end
      end
    end

    context "batch processing" do
      it "processes accounts in batches" do
        accounts = 3.times.map do
          account = create(:account)
          create_yearly_subscription(account: account, billing_day: 15)
          account
        end

        travel_to Date.current.beginning_of_month + 14.days do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.to change { CreditTransaction.count }.by(3)

          accounts.each do |account|
            expect(account.reload.plan_credits).to eq(5000)
          end
        end
      end
    end
  end
end
