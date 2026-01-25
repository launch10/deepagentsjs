# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::AllocationService do
  let(:account) { create(:account) }

  # Plan tiers with clear credit amounts
  let(:starter_tier) { create(:plan_tier, :starter) }  # 2000 credits
  let(:growth_tier) { create(:plan_tier, :growth) }    # 5000 credits
  let(:pro_tier) { create(:plan_tier, :pro) }          # 15000 credits

  # Plans linked to tiers
  let(:starter_monthly) { create(:plan, :starter_monthly, plan_tier: starter_tier) }
  let(:starter_annual) { create(:plan, :starter_annual, plan_tier: starter_tier) }
  let(:growth_monthly) { create(:plan, :growth_monthly, plan_tier: growth_tier) }
  let(:growth_annual) { create(:plan, :growth_annual, plan_tier: growth_tier) }
  let(:pro_monthly) { create(:plan, :pro_monthly, plan_tier: pro_tier) }
  let(:pro_annual) { create(:plan, :pro_annual, plan_tier: pro_tier) }

  # Default: subscription is on Growth monthly (5000 credits)
  let(:current_plan) { growth_monthly }
  let(:current_plan_tier) { growth_tier }

  let(:payment_processor) do
    account.set_payment_processor(:fake_processor, allow_fake: true).tap do |pp|
      pp.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
    end
  end

  let(:period_start) { Time.current.beginning_of_day }

  let(:subscription) do
    payment_processor.subscriptions.create!(
      processor_id: "sub_#{SecureRandom.hex(8)}",
      name: "default",
      processor_plan: current_plan.fake_processor_id || current_plan.name,
      status: "active",
      current_period_start: period_start,
      current_period_end: 30.days.from_now
    )
  end

  let(:idempotency_key) { "plan_credits:#{subscription.id}:#{period_start.to_date.iso8601}" }
  let(:service) { described_class.new(account) }

  before do
    # Ensure plan has fake_processor_id
    current_plan.update!(fake_processor_id: current_plan.name) unless current_plan.fake_processor_id.present?

    # Stub subscription.plan to return our plan
    allow(subscription).to receive(:plan).and_return(current_plan)
  end

  describe "#reset_plan_credits!" do
    # ==========================================================================
    # HAPPY PATH: First subscription / Renewals
    # ==========================================================================

    context "Scenario 1: First subscription (no existing credits)" do
      it "allocates plan credits without expiring anything" do
        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.to change { CreditTransaction.count }.by(1)

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("allocate")
        expect(transaction.credit_type).to eq("plan")
        expect(transaction.reason).to eq("plan_renewal")
        expect(transaction.amount).to eq(5000)
        expect(transaction.balance_after).to eq(5000)
        expect(transaction.plan_balance_after).to eq(5000)
        expect(transaction.pack_balance_after).to eq(0)
        expect(transaction.idempotency_key).to eq(idempotency_key)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(0)
        expect(account.total_credits).to eq(5000)
      end
    end

    context "Scenario 2: Renewal with partial usage (4000/5000 remaining)" do
      before { account.update!(plan_credits: 4000, pack_credits: 0, total_credits: 4000) }

      it "expires remaining plan credits and allocates new" do
        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.to change { CreditTransaction.count }.by(2)

        expire_tx = account.credit_transactions.where(transaction_type: "expire").last
        allocate_tx = account.credit_transactions.where(transaction_type: "allocate").last

        expect(expire_tx.amount).to eq(-4000)
        expect(expire_tx.reason).to eq("plan_credits_expired")
        expect(expire_tx.plan_balance_after).to eq(0)

        expect(allocate_tx.amount).to eq(5000)
        expect(allocate_tx.reason).to eq("plan_renewal")
        expect(allocate_tx.plan_balance_after).to eq(5000)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.total_credits).to eq(5000)
      end
    end

    context "Scenario 3: Renewal with full usage (0/5000 remaining)" do
      before { account.update!(plan_credits: 0, pack_credits: 0, total_credits: 0) }

      it "allocates new credits without expiring (nothing to expire)" do
        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.to change { CreditTransaction.count }.by(1)

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("allocate")
        expect(transaction.amount).to eq(5000)

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end

    context "Scenario 4: Renewal with negative balance (debt)" do
      before { account.update!(plan_credits: -1000, pack_credits: 0, total_credits: -1000) }

      it "absorbs debt from new allocation" do
        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.to change { CreditTransaction.count }.by(1)

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("allocate")
        expect(transaction.amount).to eq(5000)
        expect(transaction.plan_balance_after).to eq(4000) # 5000 - 1000 debt
        expect(transaction.balance_after).to eq(4000)

        account.reload
        expect(account.plan_credits).to eq(4000)
        expect(account.total_credits).to eq(4000)
      end
    end

    context "Scenario 5: Renewal with plan + pack credits" do
      before { account.update!(plan_credits: 4000, pack_credits: 500, total_credits: 4500) }

      it "expires only plan credits, preserves pack credits" do
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(500)
        expect(account.total_credits).to eq(5500)
      end
    end

    context "Scenario 6: Renewal - used all plan + some pack" do
      before { account.update!(plan_credits: 0, pack_credits: 300, total_credits: 300) }

      it "allocates new credits, pack unchanged" do
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)

        account.reload
        expect(account.plan_credits).to eq(5000)
        expect(account.pack_credits).to eq(300)
        expect(account.total_credits).to eq(5300)
      end
    end

    context "Scenario 7: Renewal - pack exhausted, plan negative" do
      before { account.update!(plan_credits: -1000, pack_credits: 0, total_credits: -1000) }

      it "absorbs debt from allocation" do
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)

        account.reload
        expect(account.plan_credits).to eq(4000) # 5000 - 1000 debt
        expect(account.pack_credits).to eq(0)
        expect(account.total_credits).to eq(4000)
      end
    end

    # ==========================================================================
    # UPGRADE: Starter → Growth, Growth → Pro
    # ==========================================================================

    context "Scenario 8: Upgrade Starter → Growth mid-period" do
      # User WAS on Starter (2000 credits), NOW on Growth (5000 credits)
      let(:current_plan) { growth_monthly }

      before do
        # Had 1000 remaining from Starter plan
        account.update!(plan_credits: 1000, pack_credits: 0, total_credits: 1000)
      end

      it "expires remaining credits from old plan, allocates full new plan" do
        expect {
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: starter_monthly
          )
        }.to change { CreditTransaction.count }.by(2)

        expire_tx = CreditTransaction.where(transaction_type: "expire").last
        allocate_tx = CreditTransaction.where(transaction_type: "allocate").last

        expect(expire_tx.amount).to eq(-1000)
        expect(expire_tx.reason).to eq("plan_credits_expired")

        expect(allocate_tx.reason).to eq("plan_upgrade")
        expect(allocate_tx.plan_balance_after).to eq(5000)

        account.reload
        expect(account.plan_credits).to eq(5000)
      end
    end

    context "Scenario 8b: Upgrade Growth → Pro mid-period" do
      # User WAS on Growth (5000 credits), NOW on Pro (15000 credits)
      let(:current_plan) { pro_monthly }

      before do
        # Had 3000 remaining from Growth plan
        account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000)
      end

      it "expires remaining Growth credits, allocates full Pro credits" do
        expect {
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: growth_monthly
          )
        }.to change { CreditTransaction.count }.by(2)

        allocate_tx = CreditTransaction.where(transaction_type: "allocate").last
        expect(allocate_tx.reason).to eq("plan_upgrade")
        expect(allocate_tx.plan_balance_after).to eq(15000)

        account.reload
        expect(account.plan_credits).to eq(15000)
      end
    end

    context "Scenario 8c: Upgrade with debt - still gets full new allocation" do
      # User was on Starter, went negative, upgrades to Growth
      let(:current_plan) { growth_monthly }

      before do
        account.update!(plan_credits: -500, pack_credits: 0, total_credits: -500)
      end

      it "absorbs debt from new allocation" do
        service.reset_plan_credits!(
          subscription: subscription,
          idempotency_key: idempotency_key,
          previous_plan: starter_monthly
        )

        account.reload
        expect(account.plan_credits).to eq(4500) # 5000 - 500 debt
        expect(account.total_credits).to eq(4500)
      end
    end

    # ==========================================================================
    # DOWNGRADE: Pro → Growth, Growth → Starter
    # ==========================================================================

    context "Scenario 9: Downgrade Pro → Growth mid-period (pro-rate)" do
      # User WAS on Pro (15000 credits), NOW on Growth (5000 credits)
      # Used 5000 credits this period, 10000 remaining
      let(:current_plan) { growth_monthly }

      before do
        account.update!(plan_credits: 10000, pack_credits: 0, total_credits: 10000)
      end

      it "pro-rates balance based on usage" do
        expect {
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: pro_monthly
          )
        }.to change { CreditTransaction.count }.by(1)

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("adjust")
        expect(transaction.reason).to eq("plan_downgrade")
        # new_balance = new_plan_credits - usage = 5000 - 5000 = 0
        expect(transaction.plan_balance_after).to eq(0)

        account.reload
        expect(account.plan_credits).to eq(0)
      end
    end

    context "Scenario 10: Downgrade with over-usage (floor at 0)" do
      # User WAS on Pro (15000 credits), NOW on Growth (5000 credits)
      # Used ALL 15000 credits this period
      let(:current_plan) { growth_monthly }

      before do
        account.update!(plan_credits: 0, pack_credits: 0, total_credits: 0)
      end

      it "floors balance at 0 (no negative from downgrade)" do
        service.reset_plan_credits!(
          subscription: subscription,
          idempotency_key: idempotency_key,
          previous_plan: pro_monthly
        )

        transaction = CreditTransaction.last
        expect(transaction.transaction_type).to eq("adjust")
        # Would be 5000 - 15000 = -10000, but floored at 0
        expect(transaction.plan_balance_after).to eq(0)

        account.reload
        expect(account.plan_credits).to eq(0)
      end
    end

    context "Scenario 10b: Downgrade Growth → Starter with partial usage" do
      # User WAS on Growth (5000 credits), NOW on Starter (2000 credits)
      # Used 1000 credits, 4000 remaining
      let(:current_plan) { starter_monthly }

      before do
        account.update!(plan_credits: 4000, pack_credits: 0, total_credits: 4000)
      end

      it "pro-rates: new_balance = starter_credits - usage" do
        service.reset_plan_credits!(
          subscription: subscription,
          idempotency_key: idempotency_key,
          previous_plan: growth_monthly
        )

        # usage = 5000 - 4000 = 1000
        # new_balance = 2000 - 1000 = 1000
        account.reload
        expect(account.plan_credits).to eq(1000)
      end
    end

    # ==========================================================================
    # EDGE CASE: Same-plan "upgrade" or "downgrade" attempts → ERROR
    # ==========================================================================

    describe "same-plan change attempts" do
      context "when trying to 'upgrade' to the same tier" do
        let(:current_plan) { growth_monthly }

        before { account.update!(plan_credits: 3000, pack_credits: 0, total_credits: 3000) }

        it "raises SamePlanError" do
          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: idempotency_key,
              previous_plan: growth_annual # Same tier (Growth), different interval
            )
          }.to raise_error(
            Credits::AllocationService::SamePlanError,
            /Cannot change to the same plan tier \(growth\)/
          )
        end

        it "does not create any transactions" do
          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: idempotency_key,
              previous_plan: growth_annual
            ) rescue nil
          }.not_to change { CreditTransaction.count }
        end
      end

      context "when trying to 'downgrade' to the same tier" do
        let(:current_plan) { starter_monthly }

        before { account.update!(plan_credits: 1000, pack_credits: 0, total_credits: 1000) }

        it "raises SamePlanError" do
          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: idempotency_key,
              previous_plan: starter_annual
            )
          }.to raise_error(Credits::AllocationService::SamePlanError)
        end
      end

      context "when changing interval on same tier (monthly → annual)" do
        let(:current_plan) { pro_annual }

        before { account.update!(plan_credits: 10000, pack_credits: 0, total_credits: 10000) }

        it "raises SamePlanError - interval changes don't warrant credit resets" do
          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: idempotency_key,
              previous_plan: pro_monthly
            )
          }.to raise_error(Credits::AllocationService::SamePlanError)
        end
      end
    end

    # ==========================================================================
    # EDGE CASE: Renewal mid-billing-cycle (without plan change) → ERROR
    # ==========================================================================

    describe "billing cycle enforcement" do
      context "when renewal already occurred this period" do
        before do
          account.update!(plan_credits: 5000, pack_credits: 0, total_credits: 5000)

          # Simulate that renewal already happened at period start
          account.credit_transactions.create!(
            transaction_type: "allocate",
            credit_type: "plan",
            reason: "plan_renewal",
            amount: 5000,
            balance_after: 5000,
            plan_balance_after: 5000,
            pack_balance_after: 0,
            reference_type: "Pay::Subscription",
            reference_id: subscription.id.to_s,
            idempotency_key: "plan_credits:#{subscription.id}:#{period_start.to_date.iso8601}"
          )
        end

        it "skips silently when using same idempotency key (normal idempotency)" do
          expect {
            service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
          }.not_to change { CreditTransaction.count }
        end

        it "raises BillingCycleError when using different idempotency key" do
          different_key = "plan_credits:#{subscription.id}:#{(period_start + 1.day).to_date.iso8601}"

          expect {
            service.reset_plan_credits!(subscription: subscription, idempotency_key: different_key)
          }.to raise_error(
            Credits::AllocationService::BillingCycleError,
            /Plan credits already allocated for this billing period/
          )
        end
      end

      context "when trying to get free credits by calling renewal with wrong key" do
        before do
          account.update!(plan_credits: 5000, pack_credits: 0, total_credits: 5000)

          # First renewal at legitimate period start
          account.credit_transactions.create!(
            transaction_type: "allocate",
            credit_type: "plan",
            reason: "plan_renewal",
            amount: 5000,
            balance_after: 5000,
            plan_balance_after: 5000,
            pack_balance_after: 0,
            reference_type: "Pay::Subscription",
            reference_id: subscription.id.to_s,
            idempotency_key: idempotency_key
          )
        end

        it "cannot get double allocation by passing fabricated idempotency key" do
          fake_key = "plan_credits:#{subscription.id}:totally_fake_period"

          expect {
            service.reset_plan_credits!(subscription: subscription, idempotency_key: fake_key)
          }.to raise_error(Credits::AllocationService::BillingCycleError)
        end

        it "cannot get double allocation by passing future period key" do
          future_key = "plan_credits:#{subscription.id}:#{30.days.from_now.to_date.iso8601}"

          expect {
            service.reset_plan_credits!(subscription: subscription, idempotency_key: future_key)
          }.to raise_error(Credits::AllocationService::BillingCycleError)
        end
      end

      context "when upgrade happens after initial renewal" do
        before do
          account.update!(plan_credits: 5000, pack_credits: 0, total_credits: 5000)

          # Initial renewal happened
          account.credit_transactions.create!(
            transaction_type: "allocate",
            credit_type: "plan",
            reason: "plan_renewal",
            amount: 5000,
            balance_after: 5000,
            plan_balance_after: 5000,
            pack_balance_after: 0,
            reference_type: "Pay::Subscription",
            reference_id: subscription.id.to_s,
            idempotency_key: idempotency_key
          )
        end

        let(:current_plan) { pro_monthly }

        it "allows upgrade mid-cycle (bypasses billing cycle check for upgrades)" do
          upgrade_key = "plan_credits:#{subscription.id}:upgrade:#{Time.current.to_i}"

          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: upgrade_key,
              previous_plan: growth_monthly
            )
          }.to change { CreditTransaction.count }.by(2) # expire + allocate
        end
      end
    end

    # ==========================================================================
    # IDEMPOTENCY
    # ==========================================================================

    describe "idempotency" do
      it "skips entire operation if idempotency_key already exists" do
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        expect(CreditTransaction.count).to eq(1)

        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.not_to change { CreditTransaction.count }
      end

      it "does not create expire transaction if allocate key exists" do
        account.update!(plan_credits: 4000, pack_credits: 0, total_credits: 4000)

        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        expect(CreditTransaction.count).to eq(2)

        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.not_to change { CreditTransaction.count }
      end
    end

    # ==========================================================================
    # TRANSACTION LOCKING
    # ==========================================================================

    describe "transaction locking" do
      it "locks account row during operation" do
        expect(account).to receive(:lock!).and_call_original
        allow(Account).to receive(:transaction).and_yield

        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
      end
    end

    # ==========================================================================
    # ERROR HANDLING
    # ==========================================================================

    describe "error handling" do
      it "raises InvalidPlanError if subscription has no plan tier" do
        plan_without_tier = create(:plan, plan_tier: nil)
        allow(subscription).to receive(:plan).and_return(plan_without_tier)

        expect {
          service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        }.to raise_error(Credits::AllocationService::InvalidPlanError, "Subscription has no plan tier")
      end
    end

    # ==========================================================================
    # CONCURRENT REQUESTS (Race Conditions)
    # ==========================================================================

    describe "race condition protection" do
      it "uses row-level locking to prevent race conditions" do
        # Verify the lock! is called - row locking prevents double allocation
        # (Full thread-safety testing requires integration tests with real concurrent connections)
        expect(account).to receive(:lock!).and_call_original

        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)

        expect(CreditTransaction.count).to eq(1)
      end

      it "idempotency key prevents duplicate even if lock timing differs" do
        # First call succeeds
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        expect(CreditTransaction.count).to eq(1)

        # Immediate second call with same key (simulates race condition loser)
        service.reset_plan_credits!(subscription: subscription, idempotency_key: idempotency_key)
        expect(CreditTransaction.count).to eq(1) # Still only 1
      end
    end

    # ==========================================================================
    # COMPLEX EDGE CASES
    # ==========================================================================

    describe "complex scenarios" do
      context "multiple plan changes in same period" do
        before do
          account.update!(plan_credits: 5000, pack_credits: 0, total_credits: 5000)

          # Initial allocation at period start
          account.credit_transactions.create!(
            transaction_type: "allocate",
            credit_type: "plan",
            reason: "plan_renewal",
            amount: 5000,
            balance_after: 5000,
            plan_balance_after: 5000,
            pack_balance_after: 0,
            reference_type: "Pay::Subscription",
            reference_id: subscription.id.to_s,
            idempotency_key: idempotency_key
          )
        end

        context "upgrade, then use credits, then downgrade" do
          it "handles sequential plan changes correctly" do
            # Step 1: Upgrade Growth → Pro
            allow(subscription).to receive(:plan).and_return(pro_monthly)
            upgrade_key = "plan_credits:#{subscription.id}:upgrade:#{Time.current.to_i}"

            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: upgrade_key,
              previous_plan: growth_monthly
            )

            account.reload
            expect(account.plan_credits).to eq(15000)

            # Step 2: Use some credits (simulate consumption)
            account.update!(plan_credits: 10000, total_credits: 10000)

            # Step 3: Downgrade Pro → Growth
            allow(subscription).to receive(:plan).and_return(growth_monthly)
            downgrade_key = "plan_credits:#{subscription.id}:downgrade:#{Time.current.to_i}"

            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: downgrade_key,
              previous_plan: pro_monthly
            )

            # Pro started with 15000, now at 10000, so used 5000
            # Downgrade to Growth (5000): new_balance = 5000 - 5000 = 0
            account.reload
            expect(account.plan_credits).to eq(0)
          end
        end

        context "double upgrade attempt with same idempotency key" do
          let(:current_plan) { pro_monthly }

          it "is idempotent - second upgrade with same key does nothing" do
            upgrade_key = "plan_credits:#{subscription.id}:upgrade:#{Time.current.to_i}"

            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: upgrade_key,
              previous_plan: growth_monthly
            )

            first_count = CreditTransaction.count

            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: upgrade_key,
              previous_plan: growth_monthly
            )

            expect(CreditTransaction.count).to eq(first_count)
          end
        end
      end

      context "downgrade preserves pack credits" do
        let(:current_plan) { starter_monthly }

        before do
          # Was on Growth, used 2000 plan credits, has 500 pack credits
          account.update!(plan_credits: 3000, pack_credits: 500, total_credits: 3500)
        end

        it "only adjusts plan credits, pack credits untouched" do
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: growth_monthly
          )

          # usage = 5000 - 3000 = 2000
          # new_plan_balance = 2000 - 2000 = 0
          account.reload
          expect(account.plan_credits).to eq(0)
          expect(account.pack_credits).to eq(500)
          expect(account.total_credits).to eq(500)
        end
      end

      context "upgrade preserves pack credits" do
        let(:current_plan) { pro_monthly }

        before do
          # Was on Starter, has 1000 plan + 300 pack
          account.update!(plan_credits: 1000, pack_credits: 300, total_credits: 1300)
        end

        it "allocates new plan credits, pack untouched" do
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: starter_monthly
          )

          account.reload
          expect(account.plan_credits).to eq(15000)
          expect(account.pack_credits).to eq(300)
          expect(account.total_credits).to eq(15300)
        end
      end

      context "yearly subscriber mid-month reset attempt" do
        before do
          account.update!(plan_credits: 4000, pack_credits: 0, total_credits: 4000)

          # Allocation happened at period start (beginning of year)
          account.credit_transactions.create!(
            transaction_type: "allocate",
            credit_type: "plan",
            reason: "plan_renewal",
            amount: 5000,
            balance_after: 5000,
            plan_balance_after: 5000,
            pack_balance_after: 0,
            reference_type: "Pay::Subscription",
            reference_id: subscription.id.to_s,
            idempotency_key: idempotency_key
          )
        end

        it "rejects mid-month renewal attempt (yearly gets one allocation per year)" do
          # Try to get another allocation mid-year
          mid_year_key = "plan_credits:#{subscription.id}:#{6.months.from_now.to_date.iso8601}"

          expect {
            service.reset_plan_credits!(subscription: subscription, idempotency_key: mid_year_key)
          }.to raise_error(Credits::AllocationService::BillingCycleError)
        end
      end

      context "edge case: previous_plan has nil plan_tier" do
        let(:current_plan) { growth_monthly }

        before { account.update!(plan_credits: 1000, pack_credits: 0, total_credits: 1000) }

        it "treats as renewal (not upgrade/downgrade) since no previous credits" do
          plan_without_tier = create(:plan, plan_tier: nil)

          # This should work because validate_plan_change! returns early if previous_tier is nil
          # And upgrade?/downgrade? will return false since previous_credits = 0
          # So it falls through to renewal path (which then validates billing cycle)
          expect {
            service.reset_plan_credits!(
              subscription: subscription,
              idempotency_key: idempotency_key,
              previous_plan: plan_without_tier
            )
          }.to change { CreditTransaction.count }.by(2) # expire + allocate
        end
      end
    end

    # ==========================================================================
    # METADATA VERIFICATION
    # ==========================================================================

    describe "transaction metadata" do
      context "for upgrades" do
        let(:current_plan) { growth_monthly }

        before { account.update!(plan_credits: 1000, pack_credits: 0, total_credits: 1000) }

        it "includes upgrade-specific metadata" do
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: starter_monthly
          )

          allocate_tx = CreditTransaction.where(reason: "plan_upgrade").last
          expect(allocate_tx.metadata["plan_tier"]).to eq("growth")
          expect(allocate_tx.metadata["credits_allocated"]).to eq(5000)
        end
      end

      context "for downgrades" do
        let(:current_plan) { starter_monthly }

        before { account.update!(plan_credits: 4000, pack_credits: 0, total_credits: 4000) }

        it "includes downgrade-specific metadata with pro-rate details" do
          service.reset_plan_credits!(
            subscription: subscription,
            idempotency_key: idempotency_key,
            previous_plan: growth_monthly
          )

          adjust_tx = CreditTransaction.where(reason: "plan_downgrade").last
          expect(adjust_tx.metadata["previous_plan"]).to eq("growth_monthly")
          expect(adjust_tx.metadata["new_plan"]).to eq("starter")
          expect(adjust_tx.metadata["usage_this_period"]).to eq(1000)
          expect(adjust_tx.metadata["pro_rated_balance"]).to eq(1000)
        end
      end
    end
  end
end
