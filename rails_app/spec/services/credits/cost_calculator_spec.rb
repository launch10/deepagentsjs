# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::CostCalculator do
  let(:account) { create(:account) }
  let(:chat) { create(:chat, account: account) }

  # Create model configs with realistic pricing (cost per million tokens)
  let!(:haiku_config) do
    create(:model_config,
      model_key: "haiku",
      model_card: "claude-haiku-4-5",
      cost_in: 1.0,      # $1 per million input tokens
      cost_out: 5.0,     # $5 per million output tokens
      cost_reasoning: 5.0,
      cache_writes: 2.0, # $2 per million cache write tokens
      cache_reads: 0.1)  # $0.10 per million cache read tokens
  end

  let!(:sonnet_config) do
    create(:model_config,
      model_key: "sonnet",
      model_card: "claude-sonnet-4-5",
      cost_in: 3.0,       # $3 per million input tokens
      cost_out: 15.0,     # $15 per million output tokens
      cost_reasoning: 15.0,
      cache_writes: 6.0,
      cache_reads: 0.3)
  end

  describe "#call" do
    context "with known model and basic tokens" do
      # Formula: millicredits = tokens × price_per_million / 10
      # Example: 100 input tokens at $1/M = 10 millicredits = 0.01 credits = $0.0001 ✓

      it "calculates correct cost for input tokens only" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 1000 tokens × $1/M / 10 = 100 millicredits
        expect(cost).to eq(100)
      end

      it "calculates correct cost for output tokens only" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 0,
          output_tokens: 1000,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 1000 tokens × $5/M / 10 = 500 millicredits
        expect(cost).to eq(500)
      end

      it "calculates correct cost for combined input and output" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # Input: 1000 × 1 / 10 = 100 millicredits
        # Output: 500 × 5 / 10 = 250 millicredits
        # Total: 350 millicredits
        expect(cost).to eq(350)
      end
    end

    context "with all token types" do
      it "sums cost across all token types" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 500,
          reasoning_tokens: 200,
          cache_creation_tokens: 300,
          cache_read_tokens: 10000)

        cost = described_class.new(usage).call
        # Input: 1000 × 1 / 10 = 100
        # Output: 500 × 5 / 10 = 250
        # Reasoning: 200 × 5 / 10 = 100 (uses cost_reasoning)
        # Cache writes: 300 × 2 / 10 = 60
        # Cache reads: 10000 × 0.1 / 10 = 100
        # Total: 610 millicredits
        expect(cost).to eq(610)
      end
    end

    context "with reasoning tokens" do
      it "uses cost_reasoning when available" do
        # Create config with different reasoning cost
        create(:model_config,
          model_key: "reasoning_test",
          model_card: "claude-reasoning-test",
          cost_in: 1.0,
          cost_out: 5.0,
          cost_reasoning: 10.0)  # Higher cost for reasoning

        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-reasoning-test",
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 1000,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 1000 × 10 / 10 = 1000 millicredits
        expect(cost).to eq(1000)
      end

      it "falls back to cost_out when cost_reasoning is nil" do
        create(:model_config,
          model_key: "no_reasoning_cost",
          model_card: "claude-no-reasoning",
          cost_in: 1.0,
          cost_out: 5.0,
          cost_reasoning: nil)

        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-no-reasoning",
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 1000,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # Falls back to cost_out: 1000 × 5 / 10 = 500 millicredits
        expect(cost).to eq(500)
      end
    end

    context "with unknown model" do
      it "raises UnknownModelError" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "completely-unknown-model",
          input_tokens: 1000,
          output_tokens: 0)

        expect {
          described_class.new(usage).call
        }.to raise_error(Credits::CostCalculator::UnknownModelError, /Unknown model: completely-unknown-model/)
      end
    end

    context "with zero tokens" do
      it "returns 0 for all zero token counts" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        expect(cost).to eq(0)
      end
    end

    context "with nil token values" do
      it "treats nil as zero via to_i conversion" do
        # Database has NOT NULL constraints with defaults, but we test the
        # conversion logic by using a stub to simulate nil values
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1000,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        # Stub the attribute methods to return nil
        allow(usage).to receive(:output_tokens).and_return(nil)
        allow(usage).to receive(:reasoning_tokens).and_return(nil)
        allow(usage).to receive(:cache_creation_tokens).and_return(nil)
        allow(usage).to receive(:cache_read_tokens).and_return(nil)

        cost = described_class.new(usage).call
        # Only input tokens: 1000 × 1 / 10 = 100 millicredits
        expect(cost).to eq(100)
      end
    end

    context "with nil rate values in config" do
      it "treats nil rates as zero cost" do
        create(:model_config,
          model_key: "partial_rates",
          model_card: "claude-partial-rates",
          cost_in: 1.0,
          cost_out: nil,
          cache_writes: nil,
          cache_reads: nil)

        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-partial-rates",
          input_tokens: 1000,
          output_tokens: 500,
          cache_creation_tokens: 100,
          cache_read_tokens: 100)

        cost = described_class.new(usage).call
        # Only input tokens have a rate: 1000 × 1 / 10 = 100 millicredits
        expect(cost).to eq(100)
      end
    end

    context "rounding" do
      it "rounds to nearest integer millicredit" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 1 × 1 / 10 = 0.1 -> rounds to 0
        expect(cost).to eq(0)
      end

      it "rounds 0.5 up" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 5,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 5 × 1 / 10 = 0.5 -> rounds to 1
        expect(cost).to eq(1)
      end
    end

    context "with more expensive model" do
      it "calculates higher cost for sonnet" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-sonnet-4-5-20250220",
          input_tokens: 1000,
          output_tokens: 500,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # Input: 1000 × 3 / 10 = 300 millicredits
        # Output: 500 × 15 / 10 = 750 millicredits
        # Total: 1050 millicredits
        expect(cost).to eq(1050)
      end
    end

    context "formula verification" do
      # Verify: millicredits = tokens × price_per_million / 10
      # where $1.00 = 100 credits = 100,000 millicredits

      it "100 Haiku input tokens costs 10 millicredits ($0.0001)" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 100,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 100 × $1/M / 10 = 10 millicredits
        expect(cost).to eq(10)

        # Verify in dollars: 10 millicredits = $0.0001
        # Actual Haiku cost: 100 tokens × $1/1M = $0.0001 ✓
      end

      it "1 million input tokens at $1/M equals $1 (100 credits = 100,000 millicredits)" do
        usage = create(:llm_usage,
          chat: chat,
          model_raw: "claude-haiku-4-5-20251001",
          input_tokens: 1_000_000,
          output_tokens: 0,
          reasoning_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0)

        cost = described_class.new(usage).call
        # 1M × $1/M / 10 = 100,000 millicredits = 100 credits = $1
        expect(cost).to eq(100_000)
      end
    end
  end
end
