# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::DailyReconciliationWorker do
  include ActiveSupport::Testing::TimeHelpers

  # Run Sidekiq jobs inline since the worker uses perform_async
  around do |example|
    Sidekiq::Testing.inline! do
      example.run
    end
  end

  let(:worker) { described_class.new }

  # Helper to set up account state with proper transaction history
  # Note: Credits are stored as millicredits internally (1 credit = 1000 millicredits)
  def setup_account_state(account:, plan_credits:, pack_credits: 0)
    plan_millicredits = plan_credits * 1000
    pack_millicredits = pack_credits * 1000
    total_millicredits = plan_millicredits + pack_millicredits
    account.credit_transactions.create!(
      transaction_type: (plan_credits >= 0) ? "allocate" : "consume",
      credit_type: "plan",
      reason: (plan_credits >= 0) ? "plan_renewal" : "ai_generation",
      amount_millicredits: plan_millicredits,
      balance_after_millicredits: total_millicredits,
      plan_balance_after_millicredits: plan_millicredits,
      pack_balance_after_millicredits: pack_millicredits,
      skip_sequence_validation: true
    )
    account.update!(plan_millicredits: plan_millicredits, pack_millicredits: pack_millicredits, total_millicredits: total_millicredits)
  end

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

    context "yearly subscriber - normal reset on billing anchor day" do
      it "resets credits on the billing anchor day (e.g., 15th)" do
        # Create account that subscribed on the 15th
        account = create(:account)
        create_yearly_subscription(account: account, billing_day: 15)

        # Set up some existing credits (simulating usage from initial allocation)
        setup_account_state(account: account, plan_credits: 3000, pack_credits: 0)

        # Travel to the 15th of NEXT month (after initial allocation month)
        next_month_15th = Date.current.next_month.beginning_of_month + 14.days
        travel_to next_month_15th do
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
        create_yearly_subscription(account: account, billing_day: 15)
        setup_account_state(account: account, plan_credits: 3000, pack_credits: 0)

        # Travel to the 10th of next month (not the billing day)
        next_month_10th = Date.current.next_month.beginning_of_month + 9.days
        travel_to next_month_10th do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.not_to change { CreditTransaction.count }

          account.reload
          expect(account.plan_credits).to eq(3000) # Unchanged
        end
      end
    end

    context "yearly subscriber - anchor day > days in month" do
      it "resets on last day of month when anchor day exceeds month days (e.g., 31st -> Feb 28)" do
        account = create(:account)

        # Create subscription that started on the 31st of a month
        payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
        payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

        # January 31st start date
        start_date = Date.new(Date.current.year, 1, 31)
        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: yearly_plan.fake_processor_id,
          status: "active",
          current_period_start: start_date.to_time,
          current_period_end: (start_date + 1.year).to_time
        )

        setup_account_state(account: account, plan_credits: 3000, pack_credits: 0)

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

    context "yearly subscriber with pending cancellation" do
      it "does not process yearly subscribers whose subscription is ending (ends_at set)" do
        account = create(:account)
        subscription = create_yearly_subscription(account: account, billing_day: 15)
        setup_account_state(account: account, plan_credits: 3000, pack_credits: 0)

        # Before cancel: ends_at is nil
        expect(subscription.ends_at).to be_nil

        # User cancels at period end. Pay sets ends_at to current_period_end.
        # ends_at != nil is what signals the subscription is winding down.
        subscription.update!(ends_at: subscription.current_period_end)
        expect(subscription.ends_at).to eq(subscription.current_period_end)

        next_month_15th = Date.current.next_month.beginning_of_month + 14.days
        travel_to next_month_15th do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          expect {
            worker.perform
          }.not_to change { CreditTransaction.count }

          expect(account.reload.plan_credits).to eq(3000) # Unchanged
        end
      end
    end

    context "monthly subscribers" do
      it "does not process monthly subscribers" do
        account = create(:account)
        payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
        payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: monthly_plan.fake_processor_id,
          status: "active",
          current_period_start: Date.current.beginning_of_month.to_time,
          current_period_end: (Date.current.beginning_of_month + 1.month).to_time
        )

        setup_account_state(account: account, plan_credits: 3000, pack_credits: 0)

        allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(monthly_plan)

        expect {
          worker.perform
        }.not_to change { CreditTransaction.count }
      end
    end

    context "idempotency" do
      it "does not double-allocate if already processed this month" do
        account = create(:account)
        create_yearly_subscription(account: account, billing_day: 15)

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

        # Travel to next month's billing day (after initial allocations)
        next_month_15th = Date.current.next_month.beginning_of_month + 14.days
        travel_to next_month_15th do
          allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(yearly_plan)

          # Each account gets expire + allocate = 2 transactions, 3 accounts = 6 total
          expect {
            worker.perform
          }.to change { CreditTransaction.count }.by(6)

          accounts.each do |account|
            expect(account.reload.plan_credits).to eq(5000)
          end
        end
      end
    end
  end
end
