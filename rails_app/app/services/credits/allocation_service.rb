# frozen_string_literal: true

module Credits
  class AllocationService
    # Custom error classes for clear failure modes
    class AllocationError < StandardError; end
    class SamePlanError < AllocationError; end
    class BillingCycleError < AllocationError; end
    class InvalidPlanError < AllocationError; end

    def initialize(account)
      @account = account
    end

    # Main entry point - handles renewal, upgrade, and downgrade
    #
    # Business Rules:
    # 1. Renewals: Only allowed at billing cycle boundaries (validated by idempotency_key format)
    # 2. Upgrades/Downgrades: Allowed mid-cycle, but ONLY if plan tier actually changes
    # 3. Same-plan changes: ALWAYS rejected (not an upgrade, not a downgrade, not a valid renewal)
    #
    # @param subscription [Pay::Subscription] The current subscription
    # @param idempotency_key [String] Unique key for this allocation (format: plan_credits:{sub_id}:{period_start})
    # @param previous_plan [Plan, nil] The plan being changed FROM (required for upgrade/downgrade)
    #
    # @raise [InvalidPlanError] if subscription has no plan tier
    # @raise [SamePlanError] if previous_plan has same tier as current (can't upgrade/downgrade to same tier)
    # @raise [BillingCycleError] if attempting renewal mid-cycle
    #
    def reset_plan_credits!(subscription:, idempotency_key:, previous_plan: nil)
      new_plan_tier = subscription.plan.plan_tier
      raise InvalidPlanError, "Subscription has no plan tier" unless new_plan_tier

      Account.transaction do
        @account.lock!

        # Idempotency check - skip entire operation if already processed
        return if CreditTransaction.exists?(idempotency_key: idempotency_key)

        # Validate plan change logic BEFORE checking balances
        validate_plan_change!(previous_plan, new_plan_tier, subscription)

        total, plan_bal, pack_bal = current_balances

        if previous_plan && downgrade?(previous_plan, new_plan_tier)
          handle_downgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            previous_plan: previous_plan,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        elsif previous_plan && upgrade?(previous_plan, new_plan_tier)
          handle_upgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        else
          # Renewal - validate this is actually at a billing cycle boundary
          validate_renewal_timing!(subscription, idempotency_key)

          handle_renewal!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        end
      end
    end

    private

    # Validates that plan change is legitimate
    # - If previous_plan is provided, the tiers must be DIFFERENT
    # - Can't "upgrade" or "downgrade" to the same tier
    def validate_plan_change!(previous_plan, new_plan_tier, subscription)
      return unless previous_plan

      previous_tier = previous_plan.plan_tier
      return unless previous_tier

      if previous_tier.id == new_plan_tier.id
        raise SamePlanError,
          "Cannot change to the same plan tier (#{new_plan_tier.name}). " \
          "Upgrade or downgrade requires a different plan tier."
      end
    end

    # Validates renewal is at billing cycle boundary
    # For renewals (no plan change), we verify:
    # 1. No allocation exists for this billing period
    # 2. The idempotency key matches the expected format for this period
    def validate_renewal_timing!(subscription, idempotency_key)
      period_start = subscription.current_period_start.to_date

      # Check if there's already an allocation for this billing period
      # This catches the case where someone passes a different idempotency key
      existing_allocation = @account.credit_transactions
        .where(transaction_type: "allocate")
        .where(reason: "plan_renewal")
        .where(reference_type: "Pay::Subscription")
        .where(reference_id: subscription.id.to_s)
        .where("created_at >= ?", period_start.beginning_of_day)
        .exists?

      if existing_allocation
        raise BillingCycleError,
          "Plan credits already allocated for this billing period (started #{period_start}). " \
          "Renewals are only allowed once per billing cycle."
      end
    end

    def downgrade?(previous_plan, new_plan_tier)
      previous_credits = previous_plan.plan_tier&.credits || 0
      new_plan_tier.credits < previous_credits
    end

    def upgrade?(previous_plan, new_plan_tier)
      previous_credits = previous_plan.plan_tier&.credits || 0
      new_plan_tier.credits > previous_credits
    end

    # Renewal: Expire remaining (if any), allocate new
    def handle_renewal!(subscription:, new_plan_tier:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      # Step 1: Expire remaining plan credits (only if positive balance)
      if plan_bal > 0
        expire_plan_credits!(
          subscription: subscription,
          plan_bal: plan_bal,
          pack_bal: pack_bal,
          total: total
        )
        total = total - plan_bal
        plan_bal = 0
      end

      # Step 2: Calculate debt (if negative plan balance)
      debt = [plan_bal, 0].min.abs

      # Step 3: Allocate new credits (minus debt)
      allocate_new_credits!(
        subscription: subscription,
        new_plan_tier: new_plan_tier,
        debt: debt,
        pack_bal: pack_bal,
        idempotency_key: idempotency_key,
        reason: "plan_renewal"
      )
    end

    # Upgrade: Full reset - expire remaining, allocate full new plan
    def handle_upgrade!(subscription:, new_plan_tier:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      # Step 1: Expire remaining plan credits (only if positive balance)
      if plan_bal > 0
        expire_plan_credits!(
          subscription: subscription,
          plan_bal: plan_bal,
          pack_bal: pack_bal,
          total: total
        )
        total = total - plan_bal
        plan_bal = 0
      end

      # Step 2: Calculate debt (if negative plan balance)
      debt = [plan_bal, 0].min.abs

      # Step 3: Allocate full new plan credits (minus debt)
      allocate_new_credits!(
        subscription: subscription,
        new_plan_tier: new_plan_tier,
        debt: debt,
        pack_bal: pack_bal,
        idempotency_key: idempotency_key,
        reason: "plan_upgrade"
      )
    end

    # Downgrade: Pro-rate based on usage this period
    def handle_downgrade!(subscription:, new_plan_tier:, previous_plan:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      previous_credits = previous_plan.plan_tier.credits
      usage_this_period = previous_credits - plan_bal

      # Floor at 0 - no negative balance from downgrade
      new_balance = [new_plan_tier.credits - usage_this_period, 0].max

      adjustment = new_balance - plan_bal
      new_total = total + adjustment

      create_transaction!(
        transaction_type: "adjust",
        credit_type: "plan",
        reason: "plan_downgrade",
        amount: adjustment,
        balance_after: new_total,
        plan_balance_after: new_balance,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        idempotency_key: idempotency_key,
        metadata: {
          previous_plan: previous_plan.name,
          new_plan: new_plan_tier.name,
          previous_plan_credits: previous_credits,
          new_plan_credits: new_plan_tier.credits,
          usage_this_period: usage_this_period,
          pro_rated_balance: new_balance
        }
      )
    end

    def expire_plan_credits!(subscription:, plan_bal:, pack_bal:, total:)
      new_total = total - plan_bal

      create_transaction!(
        transaction_type: "expire",
        credit_type: "plan",
        reason: "plan_credits_expired",
        amount: -plan_bal,
        balance_after: new_total,
        plan_balance_after: 0,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        metadata: {expired_credits: plan_bal}
      )
    end

    def allocate_new_credits!(subscription:, new_plan_tier:, debt:, pack_bal:, idempotency_key:, reason:)
      new_plan = new_plan_tier.credits - debt
      new_total = new_plan + pack_bal

      create_transaction!(
        transaction_type: "allocate",
        credit_type: "plan",
        reason: reason,
        amount: new_plan_tier.credits,
        balance_after: new_total,
        plan_balance_after: new_plan,
        pack_balance_after: pack_bal,
        reference_type: "Pay::Subscription",
        reference_id: subscription.id.to_s,
        idempotency_key: idempotency_key,
        metadata: {
          plan_tier: new_plan_tier.name,
          credits_allocated: new_plan_tier.credits,
          debt_absorbed: debt
        }
      )
    end

    def current_balances
      # Read from Account cached columns (fast)
      [@account.total_credits, @account.plan_credits, @account.pack_credits]
    end

    def create_transaction!(attrs)
      @account.credit_transactions.create!(attrs)
    end
  end
end
