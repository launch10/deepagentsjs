# == Schema Information
#
# Table name: plan_tiers
#
#  id          :bigint           not null, primary key
#  description :string
#  details     :jsonb
#  name        :string           not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_plan_tiers_on_name  (name) UNIQUE
#
require "rails_helper"

RSpec.describe PlanTier, type: :model do
  describe "validations" do
    subject { build(:plan_tier) }

    it { should validate_presence_of(:name) }
    it { should validate_uniqueness_of(:name) }
  end

  describe "associations" do
    it { should have_many(:plans).dependent(:nullify) }
    it { should have_many(:tier_limits).dependent(:destroy) }
  end

  describe "#credits" do
    it "returns credits from details as an integer" do
      tier = create(:plan_tier, details: {credits: 5000})
      expect(tier.credits).to eq(5000)
    end

    it "returns 0 when credits is nil" do
      tier = create(:plan_tier, details: {})
      expect(tier.credits).to eq(0)
    end

    it "converts string credits to integer" do
      tier = create(:plan_tier, details: {credits: "3000"})
      expect(tier.credits).to eq(3000)
    end
  end

  describe "#credits=" do
    it "stores credits as an integer" do
      tier = build(:plan_tier)
      tier.credits = "5000"
      expect(tier.details["credits"]).to eq(5000)
    end
  end

  describe "#features" do
    it "returns features array from details" do
      tier = create(:plan_tier, details: {features: ["Feature 1", "Feature 2"]})
      expect(tier.features).to eq(["Feature 1", "Feature 2"])
    end

    it "returns nil when features not set" do
      tier = create(:plan_tier, details: {})
      expect(tier.features).to be_nil
    end
  end

  describe "#limit_for" do
    let(:tier) { create(:plan_tier) }

    it "returns limit for given type" do
      create(:tier_limit, tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
      expect(tier.limit_for("requests_per_month")).to eq(1_000_000)
    end

    it "returns 0 when limit type not found" do
      expect(tier.limit_for("nonexistent")).to eq(0)
    end
  end

  describe "#display_name" do
    it "returns titleized name" do
      tier = build(:plan_tier, name: "starter")
      expect(tier.display_name).to eq("Starter")
    end
  end

  describe "#limits alias" do
    let(:tier) { create(:plan_tier) }

    it "aliases tier_limits as limits" do
      limit = create(:tier_limit, tier: tier)
      expect(tier.limits).to include(limit)
    end
  end
end
