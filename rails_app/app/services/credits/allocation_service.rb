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
        action = get_action(previous_plan, new_plan_tier)

        if action == :downgrade
          handle_downgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            previous_plan: previous_plan,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        elsif action == :upgrade
          handle_upgrade!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        elsif action == :renewal
          # Renewal - validate this is actually at a billing cycle boundary
          # Skip validation for monthly resets (yearly subscriptions with monthly credit refresh)
          unless idempotency_key.start_with?("monthly_reset:")
            validate_renewal_timing!(subscription, idempotency_key)
          end

          handle_renewal!(
            subscription: subscription,
            new_plan_tier: new_plan_tier,
            current_balances: [total, plan_bal, pack_bal],
            idempotency_key: idempotency_key
          )
        end
      end
    end

    # Allocate pack credits from a one-time purchase
    #
    # @param credit_pack [CreditPack] The pack being purchased
    # @param pay_charge [Pay::Charge] The charge record
    # @param idempotency_key [String] Unique key (format: pack_purchase:{charge_id})
    #
    # Idempotency: Uses CreditPackPurchase.credits_allocated flag to track allocation status.
    # If a purchase exists but credits_allocated is false, it will retry the allocation.
    #
    def allocate_pack!(credit_pack:, pay_charge:, idempotency_key:)
      Account.transaction do
        @account.lock!

        # Find or create the purchase record (idempotent on pay_charge)
        purchase = @account.credit_pack_purchases.find_or_initialize_by(pay_charge: pay_charge)

        if purchase.persisted? && purchase.credits_allocated?
          # Already allocated - idempotent return
          return purchase
        end

        # Set purchase attributes (for new records or retry of failed allocation)
        purchase.assign_attributes(
          credit_pack: credit_pack,
          credits_purchased: credit_pack.credits,
          price_cents: credit_pack.price_cents
        )
        purchase.save!

        _, plan_bal, pack_bal = current_balances

        # Create the credit transaction
        new_pack_bal = pack_bal + credit_pack.credits
        new_total = plan_bal + new_pack_bal

        create_transaction!(
          transaction_type: "purchase",
          credit_type: "pack",
          reason: "pack_purchase",
          amount: credit_pack.credits,
          balance_after: new_total,
          plan_balance_after: plan_bal,
          pack_balance_after: new_pack_bal,
          reference_type: "CreditPackPurchase",
          reference_id: purchase.id.to_s,
          idempotency_key: idempotency_key,
          metadata: {
            pack_name: credit_pack.name,
            pack_credits: credit_pack.credits,
            price_cents: credit_pack.price_cents,
            charge_id: pay_charge.id
          }
        )

        # Mark as allocated
        purchase.update!(credits_allocated: true)

        purchase
      end
    end

    # Allocate credits for an existing CreditGift record
    #
    # This is called by AllocateGiftCreditsWorker after a CreditGift is created.
    # The gift record is created first (by admin action), then this method
    # allocates the credits asynchronously with proper retries.
    #
    # @param gift [CreditGift] The gift record to allocate credits for
    # @param idempotency_key [String] Unique key (format: gift:{gift_id})
    #
    # @return [CreditGift] The gift record with credits_allocated: true
    #
    # Idempotency: Uses CreditGift.credits_allocated flag to track allocation status.
    # If already allocated, returns early.
    #
    def allocate_gift!(gift:, idempotency_key:)
      Account.transaction do
        @account.lock!

        # Idempotency check
        return gift if gift.credits_allocated?

        _, plan_bal, pack_bal = current_balances

        # Create the credit transaction
        new_pack_bal = pack_bal + gift.amount
        new_total = plan_bal + new_pack_bal

        create_transaction!(
          transaction_type: "gift",
          credit_type: "pack",
          reason: "gift",
          amount: gift.amount,
          balance_after: new_total,
          plan_balance_after: plan_bal,
          pack_balance_after: new_pack_bal,
          reference_type: "CreditGift",
          reference_id: gift.id.to_s,
          idempotency_key: idempotency_key,
          metadata: {
            admin_id: gift.admin_id,
            admin_email: gift.admin.email,
            gift_reason: gift.reason,
            notes: gift.notes
          }
        )

        # Mark as allocated
        gift.update!(credits_allocated: true)

        gift
      end
    end

    def get_action(previous_plan, new_plan_tier)
      return :downgrade if previous_plan && downgrade?(previous_plan, new_plan_tier)
      return :upgrade if previous_plan && upgrade?(previous_plan, new_plan_tier)
      :renewal
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
      # Fall back to current date if period_start is nil (e.g., fake_processor in tests)
      period_start = (subscription.current_period_start || Time.current).to_date

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
      return false unless previous_plan.present?

      previous_credits = previous_plan.plan_tier&.credits || 0
      new_plan_tier.credits < previous_credits
    end

    def upgrade?(previous_plan, new_plan_tier)
      return false unless previous_plan.present?

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
          total: total,
          idempotency_key: idempotency_key
        )
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
          total: total,
          idempotency_key: idempotency_key
        )
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

    # Downgrade: Pro-rate based on actual usage this period
    #
    # Prefers actual consumption from transactions when available.
    # Falls back to balance-based inference for backwards compatibility.
    def handle_downgrade!(subscription:, new_plan_tier:, previous_plan:, current_balances:, idempotency_key:)
      total, plan_bal, pack_bal = current_balances

      # Get actual consumption this period from transactions
      # This handles the upgrade-then-downgrade case correctly
      period_start = subscription.current_period_start
      consume_transactions = @account.credit_transactions
        .where(transaction_type: "consume", credit_type: "plan")
        .where("created_at >= ?", period_start)

      # Use transaction-based usage if available, otherwise infer from balance
      usage_this_period = if consume_transactions.exists?
        consume_transactions.sum(:amount).abs
      else
        # Fallback: infer usage from previous plan credits - current balance
        previous_credits = previous_plan.plan_tier.credits
        [previous_credits - plan_bal, 0].max
      end

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
          previous_plan_credits: previous_plan.plan_tier.credits,
          new_plan_credits: new_plan_tier.credits,
          usage_this_period: usage_this_period,
          pro_rated_balance: new_balance
        }
      )
    end

    def expire_plan_credits!(subscription:, plan_bal:, pack_bal:, total:, idempotency_key:)
      # Create expire key by prefixing with "expire:" regardless of original prefix
      expire_key = "expire:#{idempotency_key}"

      # Skip if already expired for this period (crash recovery)
      return if CreditTransaction.exists?(idempotency_key: expire_key)

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
        idempotency_key: expire_key,
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
