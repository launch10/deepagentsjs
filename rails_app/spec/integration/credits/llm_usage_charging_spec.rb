# frozen_string_literal: true

require "rails_helper"

RSpec.describe "LLM Usage Charging", type: :integration do
  let(:account) { create(:account) }
  let(:chat) { create(:chat, account: account) }
  let(:worker) { Credits::ChargeRunWorker.new }

  # Model configs with realistic pricing (cost per million tokens)
  # Formula: millicredits = tokens × price_per_million / 10
  # 1 millicredit = $0.00001, 1000 millicredits = 1 credit = 1 cent = $0.01
  let!(:haiku_config) do
    create(:model_config,
      model_key: "haiku",
      model_card: "claude-haiku-4-5",
      cost_in: 1.0,           # $1 per million input tokens
      cost_out: 5.0,          # $5 per million output tokens
      cost_reasoning: 5.0,
      cache_writes: 1.25,     # $1.25 per million cache write tokens
      cache_reads: 0.1)       # $0.10 per million cache read tokens
  end

  let!(:sonnet_config) do
    create(:model_config,
      model_key: "sonnet",
      model_card: "claude-sonnet-4-5",
      cost_in: 3.0,           # $3 per million input tokens
      cost_out: 15.0,         # $15 per million output tokens
      cost_reasoning: 15.0,
      cache_writes: 3.75,
      cache_reads: 0.3)
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

  describe "sub-cent LLM usage" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "charges millicredits for a small chat response (< 1 cent)" do
      run_id = "run_small_chat"

      # A typical small chat response: short user message + brief AI reply
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 500,    # User message + system context
        output_tokens: 200)   # AI response

      worker.perform(run_id)

      usage.reload
      # Input: 500 × $1/M / 10 = 50 millicredits
      # Output: 200 × $5/M / 10 = 100 millicredits
      # Total: 150 millicredits = 0.15 cents = $0.0015
      expect(usage.cost_millicredits).to eq(150)

      # Verify this is less than 1 cent (1000 millicredits)
      expect(usage.cost_millicredits).to be < 1000
      expect(usage.cost_cents).to eq 0.15 # 150 millicredits = 0.15 cents

      # Verify account was charged
      account.reload
      expect(account.plan_millicredits).to eq(5_000_000 - 150)
      expect(account.plan_credits).to eq(4999.85)
    end

    it "charges millicredits for a typical brainstorm turn (< 1 cent)" do
      run_id = "run_brainstorm"

      # Brainstorm response: more context, longer response
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1500,   # Brainstorm context + history
        output_tokens: 800)   # Detailed brainstorm response

      worker.perform(run_id)

      usage.reload
      # Input: 1500 × $1/M / 10 = 150 millicredits
      # Output: 800 × $5/M / 10 = 400 millicredits
      # Total: 550 millicredits = 0.55 cents = $0.0055
      expect(usage.cost_millicredits).to eq(550)
      expect(usage.cost_millicredits).to be < 1000
      expect(usage.cost_cents).to eq(0.55)
      expect(usage.cost_dollars).to eq(0.0055)
    end

    it "charges multiple small calls that together cost < 1 cent" do
      run_id = "run_multi_small"

      # Router call: tiny
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 100,
        output_tokens: 20)

      # Main call: small
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 300,
        output_tokens: 150)

      worker.perform(run_id)

      # Router: 100 × 1/10 + 20 × 5/10 = 10 + 10 = 20 millicredits
      # Main: 300 × 1/10 + 150 × 5/10 = 30 + 75 = 105 millicredits
      # Total: 125 millicredits
      tx = CreditTransaction.where(transaction_type: "consume").last
      expect(tx.amount_millicredits).to eq(-125)
      expect(tx.amount_millicredits.abs).to be < 1000
    end
  end

  describe "multi-call run rollup" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "aggregates multiple LLM calls in a single run into one charge" do
      run_id = "run_aggregated"

      # Simulating a brainstorm graph: router → brainstorm → title generation
      # Call 1: Router (determines which graph to run)
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 200,
        output_tokens: 50,
        graph_name: "router")

      # Call 2: Main brainstorm
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1500,
        output_tokens: 800,
        graph_name: "brainstorm")

      # Call 3: Title generation
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 400,
        output_tokens: 100,
        graph_name: "title")

      expect {
        worker.perform(run_id)
      }.to change { CreditTransaction.where(transaction_type: "consume").count }.by(1)

      tx = CreditTransaction.where(transaction_type: "consume").last

      # Router: 200 × 1/10 + 50 × 5/10 = 20 + 25 = 45
      # Brainstorm: 1500 × 1/10 + 800 × 5/10 = 150 + 400 = 550
      # Title: 400 × 1/10 + 100 × 5/10 = 40 + 50 = 90
      # Total: 685 millicredits
      expect(tx.amount_millicredits).to eq(-685)
      expect(tx.metadata["record_count"]).to eq(3)

      # Verify all usage records were marked as processed
      expect(LLMUsage.for_run(run_id).unprocessed.count).to eq(0)
      expect(LLMUsage.for_run(run_id).pluck(:cost_millicredits)).to contain_exactly(45, 550, 90)
      expect(account.reload.total_millicredits).to eq(5_000_000 - 685)
      expect(tx.amount_credits).to eq(-0.685)
    end

    it "creates separate transactions for separate runs" do
      run_id_1 = "run_first"
      run_id_2 = "run_second"

      create(:llm_usage, chat: chat, run_id: run_id_1, input_tokens: 1000, output_tokens: 500)
      create(:llm_usage, chat: chat, run_id: run_id_2, input_tokens: 2000, output_tokens: 1000)

      worker.perform(run_id_1)
      worker.perform(run_id_2)

      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(2)

      tx1 = CreditTransaction.find_by(reference_id: run_id_1)
      tx2 = CreditTransaction.find_by(reference_id: run_id_2)

      # Run 1: 1000 × 1/10 + 500 × 5/10 = 100 + 250 = 350
      expect(tx1.amount_millicredits).to eq(-350)

      # Run 2: 2000 × 1/10 + 1000 × 5/10 = 200 + 500 = 700
      expect(tx2.amount_millicredits).to eq(-700)
    end
  end

  describe "realistic conversation cost" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "tracks cost through a multi-turn brainstorm conversation" do
      # Turn 1: User describes their idea
      create(:llm_usage,
        chat: chat,
        run_id: "turn_1",
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 500,    # System prompt + user's initial message
        output_tokens: 1200)  # Detailed brainstorm response with questions
      worker.perform("turn_1")

      # Turn 2: User answers questions, AI refines
      create(:llm_usage,
        chat: chat,
        run_id: "turn_2",
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 2500,   # Growing context
        output_tokens: 1000)  # Refined suggestions
      worker.perform("turn_2")

      # Turn 3: User provides more detail, AI generates final copy
      create(:llm_usage,
        chat: chat,
        run_id: "turn_3",
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 4000,   # Full conversation context
        output_tokens: 800)   # Final marketing copy
      worker.perform("turn_3")

      # Calculate expected costs
      # Turn 1: 500 × 1/10 + 1200 × 5/10 = 50 + 600 = 650
      # Turn 2: 2500 × 1/10 + 1000 × 5/10 = 250 + 500 = 750
      # Turn 3: 4000 × 1/10 + 800 × 5/10 = 400 + 400 = 800
      # Total: 2200 millicredits = 2.2 cents = $0.022

      total_consumed = account.credit_transactions
        .where(transaction_type: "consume")
        .sum(:amount_millicredits)
        .abs

      expect(total_consumed).to eq(2200)
      expect(total_consumed).to be < 10_000  # < 10 credits for full conversation
      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(3)

      account.reload
      expect(account.plan_millicredits).to eq(5_000_000 - 2200)
    end

    it "tracks a complete website generation workflow" do
      # This simulates the full website generation: brainstorm → code gen → refinement

      # Phase 1: Brainstorm (3 turns)
      [
        {run_id: "brainstorm_1", input: 500, output: 1000},
        {run_id: "brainstorm_2", input: 2000, output: 800},
        {run_id: "brainstorm_3", input: 3000, output: 600}
      ].each do |turn|
        create(:llm_usage, chat: chat, run_id: turn[:run_id],
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: turn[:input], output_tokens: turn[:output])
        worker.perform(turn[:run_id])
      end

      # Phase 2: Website generation (uses Sonnet for quality)
      create(:llm_usage, chat: chat, run_id: "website_gen",
        model_raw: "claude-sonnet-4-5-20250220",
        input_tokens: 5000,   # Full brainstorm context + templates
        output_tokens: 8000)  # Complete website code
      worker.perform("website_gen")

      # Phase 3: Refinement (back to Haiku for quick iterations)
      [
        {run_id: "refine_1", input: 10000, output: 2000},
        {run_id: "refine_2", input: 12000, output: 1500}
      ].each do |turn|
        create(:llm_usage, chat: chat, run_id: turn[:run_id],
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: turn[:input], output_tokens: turn[:output])
        worker.perform(turn[:run_id])
      end

      # Calculate costs
      # Brainstorm 1: 500/10 + 1000×5/10 = 50 + 500 = 550
      # Brainstorm 2: 2000/10 + 800×5/10 = 200 + 400 = 600
      # Brainstorm 3: 3000/10 + 600×5/10 = 300 + 300 = 600
      # Website gen (Sonnet): 5000×3/10 + 8000×15/10 = 1500 + 12000 = 13500
      # Refine 1: 10000/10 + 2000×5/10 = 1000 + 1000 = 2000
      # Refine 2: 12000/10 + 1500×5/10 = 1200 + 750 = 1950
      # Total: 19200 millicredits = 19.2 cents = $0.192

      total_consumed = account.credit_transactions
        .where(transaction_type: "consume")
        .sum(:amount_millicredits)
        .abs

      expect(total_consumed).to eq(19_200)
      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(6)
    end
  end

  describe "zero-cost rounding" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "rounds tiny calls (1-4 tokens) to 0 millicredits" do
      run_id = "run_tiny"

      # Extremely tiny call - should round to 0
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1,
        output_tokens: 0)

      worker.perform(run_id)

      usage.reload
      # 1 × $1/M / 10 = 0.1 → rounds to 0
      expect(usage.cost_millicredits).to eq(0)

      # No consumption transaction created for zero cost
      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(0)

      # Account balance unchanged
      account.reload
      expect(account.plan_millicredits).to eq(5_000_000)
    end

    it "rounds 5 input tokens to 1 millicredit (0.5 rounds up)" do
      run_id = "run_five_tokens"

      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 5,
        output_tokens: 0)

      worker.perform(run_id)

      usage.reload
      # 5 × $1/M / 10 = 0.5 → rounds to 1
      expect(usage.cost_millicredits).to eq(1)
    end

    it "handles mixed zero and non-zero costs in same run" do
      run_id = "run_mixed_tiny"

      # Tiny call that rounds to 0
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 2,
        output_tokens: 0)

      # Normal call
      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 100,
        output_tokens: 50)

      worker.perform(run_id)

      # Tiny: 0 (rounded)
      # Normal: 100/10 + 50×5/10 = 10 + 25 = 35
      # Total: 35 millicredits
      tx = CreditTransaction.where(transaction_type: "consume").last
      expect(tx.amount_millicredits).to eq(-35)
    end
  end

  describe "cache-heavy workloads" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "calculates significant savings from cache reads" do
      run_id = "run_cached"

      # Scenario: Large context loaded from cache
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_tokens: 10_000)  # 10k tokens from cache

      worker.perform(run_id)

      usage.reload
      # Input: 1000 × $1/M / 10 = 100 millicredits
      # Output: 500 × $5/M / 10 = 250 millicredits
      # Cache reads: 10000 × $0.1/M / 10 = 100 millicredits
      # Total: 450 millicredits
      expect(usage.cost_millicredits).to eq(450)

      # Compare to what it would cost without caching:
      # If those 10k cache reads were input tokens instead:
      # 11000 × $1/M / 10 = 1100 millicredits (input)
      # 500 × $5/M / 10 = 250 millicredits (output)
      # Total without cache: 1350 millicredits
      # Savings: 1350 - 450 = 900 millicredits (67% savings!)
    end

    it "charges for cache creation (writes)" do
      run_id = "run_cache_write"

      # First call in a session: creates cache
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 5000)  # Creating cache for system prompt

      worker.perform(run_id)

      usage.reload
      # Input: 1000 × $1/M / 10 = 100 millicredits
      # Output: 500 × $5/M / 10 = 250 millicredits
      # Cache writes: 5000 × $1.25/M / 10 = 625 millicredits
      expect(usage.cost_millicredits).to eq(975)
    end

    it "handles both cache reads and writes in same call" do
      run_id = "run_cache_both"

      # Some cached context + adding to cache
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 500,
        output_tokens: 300,
        cache_read_tokens: 8000,
        cache_creation_tokens: 2000)

      worker.perform(run_id)

      usage.reload
      # Input: 500 × 1 / 10 = 50
      # Output: 300 × 5 / 10 = 150
      # Cache reads: 8000 × 0.1 / 10 = 80
      # Cache writes: 2000 × 1.25 / 10 = 250
      # Total: 530 millicredits
      expect(usage.cost_millicredits).to eq(530)
    end
  end

  describe "model cost comparison" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "shows Sonnet costs 3x more for input and 3x more for output than Haiku" do
      # Same token counts, different models
      haiku_usage = create(:llm_usage,
        chat: chat,
        run_id: "haiku_run",
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)

      sonnet_usage = create(:llm_usage,
        chat: chat,
        run_id: "sonnet_run",
        model_raw: "claude-sonnet-4-5-20250220",
        input_tokens: 1000,
        output_tokens: 500)

      worker.perform("haiku_run")
      worker.perform("sonnet_run")

      haiku_usage.reload
      sonnet_usage.reload

      # Haiku: 1000 × 1/10 + 500 × 5/10 = 100 + 250 = 350
      # Sonnet: 1000 × 3/10 + 500 × 15/10 = 300 + 750 = 1050
      expect(haiku_usage.cost_millicredits).to eq(350)
      expect(sonnet_usage.cost_millicredits).to eq(1050)

      # Sonnet is exactly 3x more expensive
      expect(sonnet_usage.cost_millicredits).to eq(haiku_usage.cost_millicredits * 3)
    end

    it "demonstrates cost difference for website generation task" do
      # Website gen with Haiku (fast, cheap)
      create(:llm_usage,
        chat: chat,
        run_id: "website_haiku",
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 5000,
        output_tokens: 8000)
      worker.perform("website_haiku")

      # Website gen with Sonnet (slower, higher quality)
      create(:llm_usage,
        chat: chat,
        run_id: "website_sonnet",
        model_raw: "claude-sonnet-4-5-20250220",
        input_tokens: 5000,
        output_tokens: 8000)
      worker.perform("website_sonnet")

      haiku_tx = CreditTransaction.find_by(reference_id: "website_haiku")
      sonnet_tx = CreditTransaction.find_by(reference_id: "website_sonnet")

      # Haiku: 5000/10 + 8000×5/10 = 500 + 4000 = 4500
      # Sonnet: 5000×3/10 + 8000×15/10 = 1500 + 12000 = 13500
      expect(haiku_tx.amount_millicredits).to eq(-4500)
      expect(sonnet_tx.amount_millicredits).to eq(-13_500)
    end
  end

  describe "reasoning token billing" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "charges reasoning tokens at the cost_reasoning rate" do
      run_id = "run_reasoning"

      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 500,
        output_tokens: 200,
        reasoning_tokens: 1000)  # Extended thinking

      worker.perform(run_id)

      usage.reload
      # Input: 500 × 1 / 10 = 50
      # Output: 200 × 5 / 10 = 100
      # Reasoning: 1000 × 5 / 10 = 500 (uses cost_reasoning rate)
      # Total: 650 millicredits
      expect(usage.cost_millicredits).to eq(650)
    end

    it "handles heavy reasoning workload" do
      run_id = "run_heavy_reasoning"

      # Complex problem requiring lots of thinking
      usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-sonnet-4-5-20250220",
        input_tokens: 2000,
        output_tokens: 500,
        reasoning_tokens: 5000)  # Lots of extended thinking

      worker.perform(run_id)

      usage.reload
      # Input: 2000 × 3 / 10 = 600
      # Output: 500 × 15 / 10 = 750
      # Reasoning: 5000 × 15 / 10 = 7500
      # Total: 8850 millicredits
      expect(usage.cost_millicredits).to eq(8850)
    end
  end

  describe "partial failures and atomicity" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "rolls back all records when one has an unknown model" do
      run_id = "run_partial_fail"

      # Valid record
      valid_usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)

      # Invalid record (unknown model)
      invalid_usage = create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "unknown-model-xyz",
        input_tokens: 1000,
        output_tokens: 500)

      expect {
        worker.perform(run_id)
      }.to raise_error(Credits::CostCalculator::UnknownModelError)

      # Neither record should be processed
      valid_usage.reload
      invalid_usage.reload
      expect(valid_usage.processed_at).to be_nil
      expect(valid_usage.cost_millicredits).to be_nil
      expect(invalid_usage.processed_at).to be_nil

      # No consumption transaction
      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(0)

      # Account balance unchanged
      account.reload
      expect(account.plan_millicredits).to eq(5_000_000)
    end

    it "maintains atomicity across cost calculation and consumption" do
      run_id = "run_atomic"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)

      # Simulate a failure during consumption by stubbing
      allow_any_instance_of(Credits::ConsumptionService)
        .to receive(:consume!)
        .and_raise(ActiveRecord::RecordInvalid.new(CreditTransaction.new))

      expect {
        worker.perform(run_id)
      }.to raise_error(ActiveRecord::RecordInvalid)

      # Usage record should not be marked as processed
      expect(LLMUsage.for_run(run_id).unprocessed.count).to eq(1)
    end
  end

  describe "concurrent run processing" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "processes concurrent runs without race conditions" do
      run_ids = 5.times.map { |i| "concurrent_run_#{i}" }

      # Create usage records for each run
      run_ids.each do |run_id|
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500)
      end

      # Process all runs (simulating concurrent processing)
      run_ids.each { |run_id| worker.perform(run_id) }

      # Each run should have exactly one transaction
      expect(CreditTransaction.where(transaction_type: "consume").count).to eq(5)

      # Each transaction should be for 350 millicredits
      CreditTransaction.where(transaction_type: "consume").each do |tx|
        expect(tx.amount_millicredits).to eq(-350)
      end

      # Total deducted should be 5 × 350 = 1750
      account.reload
      expect(account.plan_millicredits).to eq(5_000_000 - 1750)
    end

    it "is idempotent - duplicate processing does not double charge" do
      run_id = "idempotent_run"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)

      # Process the same run multiple times
      3.times { worker.perform(run_id) }

      # Should only have one transaction
      expect(CreditTransaction.where(reference_id: run_id).count).to eq(1)

      # Only charged once
      account.reload
      expect(account.plan_millicredits).to eq(5_000_000 - 350)
    end
  end

  describe "overdraft behavior" do
    it "allows consumption when account has sufficient plan credits" do
      setup_account_state(plan_millicredits: 1000)
      run_id = "run_sufficient"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)  # 350 millicredits

      worker.perform(run_id)

      account.reload
      expect(account.plan_millicredits).to eq(650)
    end

    it "allows overdraft into negative plan balance" do
      setup_account_state(plan_millicredits: 100)
      run_id = "run_overdraft"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)  # 350 millicredits

      worker.perform(run_id)

      # Should go negative
      account.reload
      expect(account.plan_millicredits).to eq(-250)

      tx = CreditTransaction.where(transaction_type: "consume").last
      # When plan has some credits but goes into overdraft, it's "split"
      # (even if pack is 0 - the split is between positive plan and overdraft)
      expect(tx.credit_type).to eq("split")
      expect(tx.plan_balance_after_millicredits).to eq(-250)
      expect(tx.metadata["plan_consumed"]).to eq(350)  # All came from plan (100 + 250 overdraft)
      expect(tx.metadata["pack_consumed"]).to eq(0)
    end

    it "uses plan credit_type when starting from zero (full overdraft)" do
      setup_account_state(plan_millicredits: 0)
      run_id = "run_full_overdraft"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)  # 350 millicredits

      worker.perform(run_id)

      account.reload
      expect(account.plan_millicredits).to eq(-350)

      tx = CreditTransaction.where(transaction_type: "consume").last
      # When both plan and pack are exhausted, credit_type is "plan"
      expect(tx.credit_type).to eq("plan")
      expect(tx.metadata["plan_consumed"]).to eq(350)
    end

    it "uses pack credits before going into overdraft" do
      setup_account_state(plan_millicredits: 100, pack_millicredits: 500)
      run_id = "run_pack_first"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)  # 350 millicredits

      worker.perform(run_id)

      # Should use 100 from plan, 250 from pack
      account.reload
      expect(account.plan_millicredits).to eq(0)
      expect(account.pack_millicredits).to eq(250)

      tx = CreditTransaction.where(transaction_type: "consume").last
      expect(tx.credit_type).to eq("split")
      expect(tx.metadata["plan_consumed"]).to eq(100)
      expect(tx.metadata["pack_consumed"]).to eq(250)
    end

    it "continues processing LLM calls even when deeply in overdraft" do
      setup_account_state(plan_millicredits: -10_000)
      run_id = "run_deep_overdraft"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)  # 350 millicredits

      # Should still process (we don't block based on balance)
      worker.perform(run_id)

      account.reload
      expect(account.plan_millicredits).to eq(-10_350)
    end
  end

  describe "transaction metadata and audit trail" do
    before { setup_account_state(plan_millicredits: 5_000_000) }

    it "includes complete metadata for auditing" do
      run_id = "run_audit"

      create(:llm_usage,
        chat: chat,
        run_id: run_id,
        model_raw: "claude-haiku-4-5-20251001",
        input_tokens: 1000,
        output_tokens: 500)

      worker.perform(run_id)

      tx = CreditTransaction.where(transaction_type: "consume").last

      expect(tx.reference_type).to eq("LLMRun")
      expect(tx.reference_id).to eq(run_id)
      expect(tx.reason).to eq("ai_generation")
      expect(tx.idempotency_key).to eq("llm_run:#{run_id}")
      expect(tx.metadata["chat_id"]).to eq(chat.id)
      expect(tx.metadata["record_count"]).to eq(1)
    end

    it "tracks balance changes accurately across transactions" do
      run_ids = ["run_a", "run_b", "run_c"]

      run_ids.each do |run_id|
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500)
        worker.perform(run_id)
      end

      # Verify balance chain
      transactions = account.credit_transactions.order(:created_at)
      transactions.each_cons(2) do |prev_tx, curr_tx|
        expected = prev_tx.balance_after_millicredits + curr_tx.amount_millicredits
        expect(curr_tx.balance_after_millicredits).to eq(expected),
          "Balance mismatch: #{prev_tx.balance_after_millicredits} + #{curr_tx.amount_millicredits} " \
          "should equal #{curr_tx.balance_after_millicredits}"
      end
    end
  end
end
