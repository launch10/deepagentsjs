require "rails_helper"

RSpec.describe ModelFallbackChain, type: :model do
  describe "validations" do
    subject { build(:model_fallback_chain) }

    it { should validate_presence_of(:cost_tier) }
    it { should validate_presence_of(:speed_tier) }
    it { should validate_presence_of(:skill) }

    it { should validate_inclusion_of(:cost_tier).in_array(ModelFallbackChain::COST_TIERS) }
    it { should validate_inclusion_of(:speed_tier).in_array(ModelFallbackChain::SPEED_TIERS) }
    it { should validate_inclusion_of(:skill).in_array(ModelFallbackChain::SKILLS) }

    it "validates uniqueness of cost_tier scoped to speed_tier and skill" do
      create(:model_fallback_chain, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      duplicate = build(:model_fallback_chain, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:cost_tier]).to include("has already been taken")
    end
  end

  describe "constants" do
    it "defines valid cost tiers" do
      expect(ModelFallbackChain::COST_TIERS).to eq(%w[free paid])
    end

    it "defines valid speed tiers" do
      expect(ModelFallbackChain::SPEED_TIERS).to eq(%w[blazing fast slow])
    end

    it "defines valid skills" do
      expect(ModelFallbackChain::SKILLS).to eq(%w[planning writing coding reasoning])
    end
  end

  describe ".for" do
    it "finds a fallback chain by cost_tier, speed_tier, and skill" do
      chain = create(:model_fallback_chain, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      expect(ModelFallbackChain.for("paid", "slow", "coding")).to eq(chain)
    end

    it "returns nil when not found" do
      expect(ModelFallbackChain.for("paid", "slow", "coding")).to be_nil
    end
  end

  describe ".all_chains" do
    it "returns all chains grouped by cost_tier, speed_tier, and skill" do
      create(:model_fallback_chain, cost_tier: "paid", speed_tier: "slow", skill: "coding", model_keys: %w[opus sonnet])
      create(:model_fallback_chain, cost_tier: "paid", speed_tier: "fast", skill: "writing", model_keys: %w[haiku])

      result = ModelFallbackChain.all_chains

      expect(result.dig("paid", "slow", "coding")).to eq(%w[opus sonnet])
      expect(result.dig("paid", "fast", "writing")).to eq(%w[haiku])
    end
  end

  describe "model_keys" do
    it "allows an empty array" do
      chain = create(:model_fallback_chain, model_keys: [])
      expect(chain.model_keys).to eq([])
    end

    it "stores and retrieves an array of model keys" do
      chain = create(:model_fallback_chain, model_keys: %w[opus sonnet haiku])
      chain.reload
      expect(chain.model_keys).to eq(%w[opus sonnet haiku])
    end

    it "preserves order of model keys" do
      chain = create(:model_fallback_chain, model_keys: %w[haiku sonnet opus])
      chain.reload
      expect(chain.model_keys).to eq(%w[haiku sonnet opus])
    end
  end
end
