# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::ChargeRunWorker do
  let(:account) { create(:account) }
  let(:chat) { create(:chat, account: account) }
  let(:worker) { described_class.new }

  # Create model config for Haiku with realistic pricing
  let!(:haiku_config) do
    create(:model_config,
      model_key: "haiku",
      model_card: "claude-haiku-4-5",
      cost_in: 1.0,      # $1 per million input tokens
      cost_out: 5.0,     # $5 per million output tokens
      cost_reasoning: 5.0,
      cache_writes: 2.0,
      cache_reads: 0.1)
  end

  # Helper to set up account state with specific balances
  def setup_account_state(plan_millicredits:, pack_millicredits: 0)
    total = plan_millicredits + pack_millicredits

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

  describe "#perform" do
    let(:run_id) { "run_#{SecureRandom.hex(8)}" }

    context "when CREDITS_DISABLED is set" do
      around do |example|
        ENV["CREDITS_DISABLED"] = "true"
        example.run
      ensure
        ENV.delete("CREDITS_DISABLED")
      end

      it "returns early without processing any records" do
        setup_account_state(plan_millicredits: 5_000_000)

        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500,
          processed_at: nil)

        expect {
          worker.perform(run_id)
        }.not_to change { CreditTransaction.count }

        # Usage records should remain unprocessed
        expect(LLMUsage.unprocessed.for_run(run_id).count).to eq(1)
      end

      it "does not deduct from account balance" do
        setup_account_state(plan_millicredits: 5_000_000)

        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500,
          processed_at: nil)

        worker.perform(run_id)

        account.reload
        expect(account.plan_millicredits).to eq(5_000_000)
      end
    end

    context "with unprocessed usage records" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "calculates cost and marks records as processed" do
        usage = create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500,
          processed_at: nil)

        worker.perform(run_id)

        usage.reload
        # Input: 1000 × 1 / 10 = 100 millicredits
        # Output: 500 × 5 / 10 = 250 millicredits
        # Total: 350 millicredits
        expect(usage.cost_millicredits).to eq(350)
        expect(usage.processed_at).to be_present
      end

      it "creates a consumption transaction for total cost" do
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        expect {
          worker.perform(run_id)
        }.to change { CreditTransaction.where(transaction_type: "consume").count }.by(1)

        tx = CreditTransaction.where(transaction_type: "consume").last
        expect(tx.amount_millicredits).to eq(-100)
        expect(tx.reference_type).to eq("LLMRun")
        expect(tx.reference_id).to eq(run_id)
        expect(tx.idempotency_key).to eq("llm_run:#{run_id}")
      end

      it "sums cost across multiple usage records in same run" do
        # Record 1: 100 millicredits
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        # Record 2: 250 millicredits
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 0,
          output_tokens: 500,
          processed_at: nil)

        worker.perform(run_id)

        tx = CreditTransaction.where(transaction_type: "consume").last
        expect(tx.amount_millicredits).to eq(-350)
        expect(tx.metadata["record_count"]).to eq(2)

        account.reload
        expect(account.plan_millicredits).to eq(5_000_000 - 350)
      end

      it "includes chat_id in transaction metadata" do
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        worker.perform(run_id)

        tx = CreditTransaction.where(transaction_type: "consume").last
        expect(tx.metadata["chat_id"]).to eq(chat.id)
      end
    end

    context "with already processed records" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "skips records that are already processed" do
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: 1.hour.ago,
          cost_millicredits: 100)

        expect {
          worker.perform(run_id)
        }.not_to change { CreditTransaction.count }
      end
    end

    context "with no records" do
      it "does nothing when no records exist for run" do
        expect {
          worker.perform("nonexistent_run")
        }.not_to change { CreditTransaction.count }
      end
    end

    context "with zero total cost" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "does not create consumption transaction when total is zero" do
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 0,
          output_tokens: 0,
          processed_at: nil)

        expect {
          worker.perform(run_id)
        }.not_to change { CreditTransaction.where(transaction_type: "consume").count }

        # But records should still be marked as processed
        expect(LLMUsage.last.processed?).to be true
      end
    end

    context "with unknown model" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "raises UnknownModelError and does not mark as processed" do
        usage = create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "completely-unknown-model",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        expect {
          worker.perform(run_id)
        }.to raise_error(Credits::CostCalculator::UnknownModelError, /Unknown model/)

        usage.reload
        expect(usage.processed_at).to be_nil
        expect(usage.cost_millicredits).to be_nil
      end
    end

    context "idempotency" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "is idempotent - second call does not double charge" do
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        worker.perform(run_id)
        initial_balance = account.reload.plan_millicredits

        # Second call - all records already processed, no new consumption
        worker.perform(run_id)
        final_balance = account.reload.plan_millicredits

        expect(final_balance).to eq(initial_balance)
        expect(CreditTransaction.where(transaction_type: "consume").count).to eq(1)
      end
    end

    context "transaction atomicity" do
      before do
        setup_account_state(plan_millicredits: 5_000_000)
      end

      it "rolls back if cost calculation fails mid-batch" do
        # First record - valid model
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        # Second record - invalid model (should cause failure)
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "unknown-model-xyz",
          input_tokens: 1000,
          output_tokens: 0,
          processed_at: nil)

        expect {
          worker.perform(run_id)
        }.to raise_error(Credits::CostCalculator::UnknownModelError)

        # Neither record should be marked as processed
        expect(LLMUsage.unprocessed.count).to eq(2)

        # No consumption transaction should exist
        expect(CreditTransaction.where(transaction_type: "consume").count).to eq(0)
      end
    end
  end
end
