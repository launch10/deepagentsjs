# frozen_string_literal: true

module Credits
  # Deducts millicredits from an account for AI generation usage.
  #
  # Consumption Order:
  # 1. Plan credits first (if positive balance)
  # 2. Pack credits second
  # 3. Plan overdraft (negative balance) if both exhausted
  #
  # The service creates a single CreditTransaction with metadata showing
  # how the consumption was split between plan and pack credits.
  #
  class ConsumptionService
    def initialize(account)
      @account = account
    end

    # Consume credits for an LLM run.
    #
    # @param cost_millicredits [Integer] Total cost in millicredits
    # @param idempotency_key [String] Unique key (format: llm_run:{run_id})
    # @param reference_id [String] The LLM run ID
    # @param metadata [Hash] Additional metadata to store
    #
    # @return [CreditTransaction, nil] The transaction record, or nil if cost is zero
    #
    def consume!(cost_millicredits:, idempotency_key:, reference_id:, metadata: {})
      return nil if cost_millicredits.zero?

      Account.transaction do
        @account.lock!

        # Idempotency check
        existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
        return existing if existing

        plan_bal = @account.plan_millicredits
        pack_bal = @account.pack_millicredits

        split = calculate_consumption_split(cost_millicredits, plan_bal, pack_bal)

        create_consumption_transaction!(
          cost_millicredits: cost_millicredits,
          **split,
          reference_id: reference_id,
          idempotency_key: idempotency_key,
          metadata: metadata
        )
      end
    end

    private

    # Calculate how to split consumption between plan and pack credits.
    #
    # @param cost [Integer] Total cost in millicredits
    # @param plan_bal [Integer] Current plan balance
    # @param pack_bal [Integer] Current pack balance
    #
    # @return [Hash] Split details including balances and credit_type
    #
    def calculate_consumption_split(cost, plan_bal, pack_bal)
      if plan_bal >= cost
        # All from plan
        {
          plan_consumed: cost,
          pack_consumed: 0,
          new_plan_bal: plan_bal - cost,
          new_pack_bal: pack_bal,
          credit_type: "plan"
        }
      elsif plan_bal > 0
        # Split between plan and pack
        remaining = cost - plan_bal

        if pack_bal >= remaining
          # Pack covers the rest
          {
            plan_consumed: plan_bal,
            pack_consumed: remaining,
            new_plan_bal: 0,
            new_pack_bal: pack_bal - remaining,
            credit_type: "split"
          }
        else
          # Pack exhausted, remainder goes to plan overdraft
          overdraft = remaining - pack_bal
          {
            plan_consumed: plan_bal + overdraft,
            pack_consumed: pack_bal,
            new_plan_bal: -overdraft,
            new_pack_bal: 0,
            credit_type: "split"
          }
        end
      elsif pack_bal > 0
        # Plan is 0 or negative, use pack
        if pack_bal >= cost
          {
            plan_consumed: 0,
            pack_consumed: cost,
            new_plan_bal: plan_bal,
            new_pack_bal: pack_bal - cost,
            credit_type: "pack"
          }
        else
          # Pack exhausted, remainder goes to plan overdraft
          overdraft = cost - pack_bal
          {
            plan_consumed: overdraft,
            pack_consumed: pack_bal,
            new_plan_bal: plan_bal - overdraft,
            new_pack_bal: 0,
            credit_type: "split"
          }
        end
      else
        # Both exhausted, full overdraft on plan
        {
          plan_consumed: cost,
          pack_consumed: 0,
          new_plan_bal: plan_bal - cost,
          new_pack_bal: pack_bal,
          credit_type: "plan"
        }
      end
    end

    def create_consumption_transaction!(cost_millicredits:, plan_consumed:, pack_consumed:,
      new_plan_bal:, new_pack_bal:, credit_type:,
      reference_id:, idempotency_key:, metadata:)
      tx = @account.credit_transactions.create!(
        transaction_type: "consume",
        credit_type: credit_type,
        reason: "ai_generation",
        amount_millicredits: -cost_millicredits,
        balance_after_millicredits: new_plan_bal + new_pack_bal,
        plan_balance_after_millicredits: new_plan_bal,
        pack_balance_after_millicredits: new_pack_bal,
        reference_type: "LLMRun",
        reference_id: reference_id,
        idempotency_key: idempotency_key,
        metadata: metadata.merge(
          plan_consumed: plan_consumed,
          pack_consumed: pack_consumed
        )
      )

      # Update account balances
      @account.update!(
        plan_millicredits: new_plan_bal,
        pack_millicredits: new_pack_bal,
        total_millicredits: new_plan_bal + new_pack_bal
      )

      tx
    end
  end
end
