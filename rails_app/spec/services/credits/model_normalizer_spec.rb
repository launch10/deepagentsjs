# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::ModelNormalizer do
  # Set up test model configs with different model_card prefixes
  let!(:haiku_config) do
    create(:model_config, model_key: "haiku", model_card: "claude-haiku-4-5", cost_in: 1.0, cost_out: 5.0)
  end

  let!(:sonnet_config) do
    create(:model_config, model_key: "sonnet", model_card: "claude-sonnet-4-5", cost_in: 3.0, cost_out: 15.0)
  end

  let!(:opus_config) do
    create(:model_config, model_key: "opus", model_card: "claude-opus-4-5", cost_in: 5.0, cost_out: 25.0)
  end

  let!(:gpt_config) do
    create(:model_config, model_key: "gpt5_mini", model_card: "gpt-5-mini", cost_in: 0.25, cost_out: 2.0)
  end

  describe ".call" do
    context "with exact match" do
      it "returns config when model_raw exactly matches model_card" do
        result = described_class.call("claude-haiku-4-5")
        expect(result).to eq(haiku_config)
      end
    end

    context "with prefix match" do
      it "returns config when model_raw starts with model_card prefix" do
        result = described_class.call("claude-haiku-4-5-20251001")
        expect(result).to eq(haiku_config)
      end

      it "returns longest matching prefix when multiple configs match" do
        # Create a more specific config
        haiku_specific = create(:model_config,
          model_key: "haiku_specific",
          model_card: "claude-haiku-4-5-20251001",
          cost_in: 0.8, cost_out: 4.0)

        result = described_class.call("claude-haiku-4-5-20251001-beta")

        # Should match the longer prefix (claude-haiku-4-5-20251001)
        expect(result).to eq(haiku_specific)
      end

      it "returns config for sonnet variant" do
        result = described_class.call("claude-sonnet-4-5-20250220")
        expect(result).to eq(sonnet_config)
      end

      it "returns config for GPT models" do
        result = described_class.call("gpt-5-mini-2025")
        expect(result).to eq(gpt_config)
      end
    end

    context "with no match" do
      it "returns nil when no config matches" do
        result = described_class.call("unknown-model-xyz")
        expect(result).to be_nil
      end

      it "returns nil when model_raw does not start with any model_card" do
        result = described_class.call("gemini-pro-latest")
        expect(result).to be_nil
      end
    end

    context "with blank input" do
      it "returns nil for nil input" do
        expect(described_class.call(nil)).to be_nil
      end

      it "returns nil for empty string" do
        expect(described_class.call("")).to be_nil
      end

      it "returns nil for whitespace-only string" do
        expect(described_class.call("  ")).to be_nil
      end
    end

    context "edge cases" do
      it "handles partial prefix that doesn't fully match" do
        # "claude" should not match "claude-haiku-4-5" because
        # model_raw should START WITH model_card, not the other way around
        result = described_class.call("claude")
        expect(result).to be_nil
      end

      it "is case-sensitive" do
        # Case mismatch should not match
        result = described_class.call("Claude-Haiku-4-5")
        expect(result).to be_nil
      end
    end
  end
end
