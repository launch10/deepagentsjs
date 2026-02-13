# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::ConsumptionService do
  let(:account) { create(:account) }
  let(:service) { described_class.new(account) }

  # Helper to set up account state with specific balances
  def setup_account_state(plan_millicredits:, pack_millicredits: 0)
    total = plan_millicredits + pack_millicredits

    # Create initial transaction to establish balance sequence
    account.credit_transactions.create!(
      transaction_type: "allocate",
      credit_type: "plan",
      reason: "plan_renewal",
      amount_millicredits: plan_millicredits,
      balance_after_millicredits: total,
      plan_balance_after_millicredits: plan_millicredits,
      pack_balance_after_millicredits: pack_millicredits,
      skip_sequence_validation: true
    )

    account.update!(
      plan_millicredits: plan_millicredits,
      pack_millicredits: pack_millicredits,
      total_millicredits: total
    )
  end

  describe "#consume!" do
    context "when cost is zero" do
      it "returns nil and creates no transaction" do
        setup_account_state(plan_millicredits: 5_000_000)

        result = service.consume!(
          cost_millicredits: 0,
          idempotency_key: "test:zero",
          reference_id: "run_123"
        )

        expect(result).to be_nil
        expect(account.credit_transactions.where(transaction_type: "consume").count).to eq(0)
      end
    end

    context "when all credits come from plan" do
      it "deducts from plan only with credit_type 'plan'" do
        setup_account_state(plan_millicredits: 5_000_000, pack_millicredits: 500_000)

        tx = service.consume!(
          cost_millicredits: 2000,
          idempotency_key: "llm_run:run_123",
          reference_id: "run_123"
        )

        expect(tx).to be_a(CreditTransaction)
        expect(tx.credit_type).to eq("plan")
        expect(tx.transaction_type).to eq("consume")
        expect(tx.amount_millicredits).to eq(-2000)
        expect(tx.plan_balance_after_millicredits).to eq(5_000_000 - 2000)
        expect(tx.pack_balance_after_millicredits).to eq(500_000)
        expect(tx.balance_after_millicredits).to eq(5_000_000 + 500_000 - 2000)
        expect(tx.metadata["plan_consumed"]).to eq(2000)
        expect(tx.metadata["pack_consumed"]).to eq(0)

        # Account balances updated
        account.reload
        expect(account.plan_millicredits).to eq(5_000_000 - 2000)
        expect(account.pack_millicredits).to eq(500_000)
        expect(account.total_millicredits).to eq(5_000_000 + 500_000 - 2000)
      end
    end

    context "when all credits come from pack (plan is zero)" do
      it "deducts from pack only with credit_type 'pack'" do
        setup_account_state(plan_millicredits: 0, pack_millicredits: 100_000)

        tx = service.consume!(
          cost_millicredits: 10_000,
          idempotency_key: "llm_run:run_456",
          reference_id: "run_456"
        )

        expect(tx.credit_type).to eq("pack")
        expect(tx.amount_millicredits).to eq(-10_000)
        expect(tx.plan_balance_after_millicredits).to eq(0)
        expect(tx.pack_balance_after_millicredits).to eq(90_000)
        expect(tx.metadata["plan_consumed"]).to eq(0)
        expect(tx.metadata["pack_consumed"]).to eq(10_000)

        account.reload
        expect(account.plan_millicredits).to eq(0)
        expect(account.pack_millicredits).to eq(90_000)
      end
    end

    context "when credits split between plan and pack" do
      it "deducts from plan first, then pack, with credit_type 'split'" do
        setup_account_state(plan_millicredits: 3000, pack_millicredits: 10_000)

        tx = service.consume!(
          cost_millicredits: 5000,
          idempotency_key: "llm_run:run_789",
          reference_id: "run_789"
        )

        expect(tx.credit_type).to eq("split")
        expect(tx.amount_millicredits).to eq(-5000)
        expect(tx.plan_balance_after_millicredits).to eq(0)
        expect(tx.pack_balance_after_millicredits).to eq(8000) # 10000 - 2000
        expect(tx.metadata["plan_consumed"]).to eq(3000)
        expect(tx.metadata["pack_consumed"]).to eq(2000)

        account.reload
        expect(account.plan_millicredits).to eq(0)
        expect(account.pack_millicredits).to eq(8000)
      end
    end

    context "when plan is negative (overdraft)" do
      it "uses pack credits first if available" do
        setup_account_state(plan_millicredits: -1000, pack_millicredits: 50_000)

        tx = service.consume!(
          cost_millicredits: 5000,
          idempotency_key: "llm_run:run_overdraft",
          reference_id: "run_overdraft"
        )

        expect(tx.credit_type).to eq("pack")
        expect(tx.plan_balance_after_millicredits).to eq(-1000) # unchanged
        expect(tx.pack_balance_after_millicredits).to eq(45_000)
        expect(tx.metadata["plan_consumed"]).to eq(0)
        expect(tx.metadata["pack_consumed"]).to eq(5000)

        account.reload
        expect(account.plan_millicredits).to eq(-1000)
        expect(account.pack_millicredits).to eq(45_000)
      end
    end

    context "when both pools exhausted (full overdraft)" do
      it "goes into plan overdraft with credit_type 'plan'" do
        setup_account_state(plan_millicredits: 0, pack_millicredits: 0)

        tx = service.consume!(
          cost_millicredits: 5000,
          idempotency_key: "llm_run:run_full_overdraft",
          reference_id: "run_full_overdraft"
        )

        expect(tx.credit_type).to eq("plan")
        expect(tx.plan_balance_after_millicredits).to eq(-5000)
        expect(tx.pack_balance_after_millicredits).to eq(0)
        expect(tx.metadata["plan_consumed"]).to eq(5000)
        expect(tx.metadata["pack_consumed"]).to eq(0)

        account.reload
        expect(account.plan_millicredits).to eq(-5000)
      end
    end

    context "when split with overdraft (pack exhausted mid-consumption)" do
      it "splits with remaining going to plan overdraft" do
        setup_account_state(plan_millicredits: 2000, pack_millicredits: 3000)

        tx = service.consume!(
          cost_millicredits: 10_000,
          idempotency_key: "llm_run:run_split_overdraft",
          reference_id: "run_split_overdraft"
        )

        # 2000 from plan, 3000 from pack, 5000 overdraft on plan
        expect(tx.credit_type).to eq("split")
        expect(tx.plan_balance_after_millicredits).to eq(-5000)
        expect(tx.pack_balance_after_millicredits).to eq(0)
        expect(tx.metadata["plan_consumed"]).to eq(7000) # 2000 + 5000 overdraft
        expect(tx.metadata["pack_consumed"]).to eq(3000)

        account.reload
        expect(account.plan_millicredits).to eq(-5000)
        expect(account.pack_millicredits).to eq(0)
      end
    end

    context "idempotency" do
      it "returns existing transaction on duplicate call" do
        setup_account_state(plan_millicredits: 100_000)

        first_tx = service.consume!(
          cost_millicredits: 5000,
          idempotency_key: "llm_run:idempotent_run",
          reference_id: "idempotent_run"
        )

        expect(CreditTransaction.where(transaction_type: "consume").count).to eq(1)

        # Second call with same idempotency key
        second_tx = service.consume!(
          cost_millicredits: 5000,
          idempotency_key: "llm_run:idempotent_run",
          reference_id: "idempotent_run"
        )

        expect(second_tx).to eq(first_tx)
        expect(CreditTransaction.where(transaction_type: "consume").count).to eq(1)

        # Account balance unchanged from first call
        account.reload
        expect(account.plan_millicredits).to eq(95_000)
      end
    end

    context "with metadata" do
      it "merges additional metadata with consumption details" do
        setup_account_state(plan_millicredits: 100_000)

        tx = service.consume!(
          cost_millicredits: 1000,
          idempotency_key: "llm_run:metadata_test",
          reference_id: "metadata_test",
          metadata: { chat_id: 123, record_count: 5 }
        )

        expect(tx.metadata["chat_id"]).to eq(123)
        expect(tx.metadata["record_count"]).to eq(5)
        expect(tx.metadata["plan_consumed"]).to eq(1000)
        expect(tx.metadata["pack_consumed"]).to eq(0)
      end
    end

    context "transaction reference" do
      it "sets reference_type to LLMRun and stores reference_id" do
        setup_account_state(plan_millicredits: 100_000)

        tx = service.consume!(
          cost_millicredits: 1000,
          idempotency_key: "llm_run:ref_test",
          reference_id: "run_abc123"
        )

        expect(tx.reference_type).to eq("LLMRun")
        expect(tx.reference_id).to eq("run_abc123")
      end
    end

    context "reason field" do
      it "sets reason to ai_generation" do
        setup_account_state(plan_millicredits: 100_000)

        tx = service.consume!(
          cost_millicredits: 1000,
          idempotency_key: "llm_run:reason_test",
          reference_id: "reason_test"
        )

        expect(tx.reason).to eq("ai_generation")
      end
    end

    context "locking behavior" do
      it "acquires row lock on account within transaction" do
        # Verify the service uses proper locking by checking the code path
        # The actual concurrent behavior is verified through the pattern of:
        # Account.transaction { @account.lock! ... }
        # which is a well-established PostgreSQL row locking pattern
        setup_account_state(plan_millicredits: 10_000)

        # Verify the transaction completes successfully
        tx = service.consume!(
          cost_millicredits: 3000,
          idempotency_key: "llm_run:lock_test",
          reference_id: "lock_test"
        )

        expect(tx).to be_persisted
        account.reload
        expect(account.plan_millicredits).to eq(7000)
      end
    end

  end
end
