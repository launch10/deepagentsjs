# == Schema Information
#
# Table name: model_preferences
#
#  id         :bigint           not null, primary key
#  cost_tier  :string           not null
#  model_keys :string           default([]), not null, is an Array
#  skill      :string           not null
#  speed_tier :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  idx_model_preferences_unique  (cost_tier,speed_tier,skill) UNIQUE
#
require "rails_helper"

RSpec.describe ModelPreference, type: :model do
  describe "validations" do
    subject { build(:model_preference) }

    it { should validate_presence_of(:cost_tier) }
    it { should validate_presence_of(:speed_tier) }
    it { should validate_presence_of(:skill) }

    it { should validate_inclusion_of(:cost_tier).in_array(ModelPreference::COST_TIERS) }
    it { should validate_inclusion_of(:speed_tier).in_array(ModelPreference::SPEED_TIERS) }
    it { should validate_inclusion_of(:skill).in_array(ModelPreference::SKILLS) }

    it "validates uniqueness of cost_tier scoped to speed_tier and skill" do
      create(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      duplicate = build(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:cost_tier]).to include("has already been taken")
    end
  end

  describe "constants" do
    it "defines valid cost tiers" do
      expect(ModelPreference::COST_TIERS).to eq(%w[free paid])
    end

    it "defines valid speed tiers" do
      expect(ModelPreference::SPEED_TIERS).to eq(%w[blazing fast slow])
    end

    it "defines valid skills" do
      expect(ModelPreference::SKILLS).to eq(%w[planning writing coding reasoning])
    end
  end

  describe ".for" do
    it "finds a preference by cost_tier, speed_tier, and skill" do
      pref = create(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding")
      expect(ModelPreference.for("paid", "slow", "coding")).to eq(pref)
    end

    it "returns nil when not found" do
      expect(ModelPreference.for("paid", "slow", "coding")).to be_nil
    end
  end

  describe ".all_preferences" do
    it "returns all preferences grouped by cost_tier, speed_tier, and skill" do
      create(:model_preference, cost_tier: "paid", speed_tier: "slow", skill: "coding", model_keys: %w[opus sonnet])
      create(:model_preference, cost_tier: "paid", speed_tier: "fast", skill: "writing", model_keys: %w[haiku])

      result = ModelPreference.all_preferences

      expect(result.dig("paid", "slow", "coding")).to eq(%w[opus sonnet])
      expect(result.dig("paid", "fast", "writing")).to eq(%w[haiku])
    end
  end

  describe "model_keys" do
    it "allows an empty array" do
      pref = create(:model_preference, model_keys: [])
      expect(pref.model_keys).to eq([])
    end

    it "stores and retrieves an array of model keys" do
      pref = create(:model_preference, model_keys: %w[opus sonnet haiku])
      pref.reload
      expect(pref.model_keys).to eq(%w[opus sonnet haiku])
    end

    it "preserves order of model keys" do
      pref = create(:model_preference, model_keys: %w[haiku sonnet opus])
      pref.reload
      expect(pref.model_keys).to eq(%w[haiku sonnet opus])
    end
  end
end
