require "rails_helper"

RSpec.describe Plan, type: :model do
  describe "associations" do
    it { should belong_to(:plan_tier).optional }
  end

  describe "delegation to plan_tier" do
    let(:tier) { create(:plan_tier, :starter) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
      create(:tier_limit, plan_tier: tier, limit_type: "platform_subdomains", limit: 1)
    end

    describe "#tier_name" do
      it "returns the tier name when plan_tier is present" do
        expect(plan.tier_name).to eq("starter")
      end

      it "extracts tier name from plan name when no plan_tier" do
        plan_without_tier = create(:plan, name: "starter_monthly", plan_tier: nil)
        expect(plan_without_tier.tier_name).to eq("starter")
      end
    end

    describe "#credits" do
      it "delegates to plan_tier" do
        expect(plan.credits).to eq(tier.credits)
      end

      it "returns nil when no plan_tier" do
        plan.plan_tier = nil
        expect(plan.credits).to be_nil
      end
    end

    describe "#display_name" do
      it "delegates to plan_tier" do
        expect(plan.display_name).to eq(tier.display_name)
      end
    end
  end

  describe "#limit_for" do
    let(:tier) { create(:plan_tier) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
    end

    it "returns limit for given type via tier" do
      expect(plan.limit_for("requests_per_month")).to eq(1_000_000)
    end

    it "returns 0 when limit not found" do
      expect(plan.limit_for("nonexistent")).to eq(0)
    end

    it "returns 0 when no plan_tier" do
      plan.plan_tier = nil
      expect(plan.limit_for("requests_per_month")).to eq(0)
    end
  end

  describe "#monthly_request_limit" do
    let(:tier) { create(:plan_tier) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 5_000_000)
    end

    it "returns requests_per_month limit" do
      expect(plan.monthly_request_limit).to eq(5_000_000)
    end

    it "returns 0 when no plan_tier" do
      plan.plan_tier = nil
      expect(plan.monthly_request_limit).to eq(0)
    end
  end

  describe "#plan_limits (backward compatibility)" do
    let(:tier) { create(:plan_tier) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
    end

    it "returns tier_limits through plan_tier" do
      expect(plan.plan_limits.count).to eq(1)
      expect(plan.plan_limits.first.limit_type).to eq("requests_per_month")
    end

    it "returns empty relation when no plan_tier" do
      plan.plan_tier = nil
      expect(plan.plan_limits).to eq(TierLimit.none)
    end
  end

  describe "#tier_limits" do
    let(:tier) { create(:plan_tier) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
    end

    it "delegates to plan_tier" do
      expect(plan.tier_limits.count).to eq(1)
    end
  end

  describe "#limits" do
    let(:tier) { create(:plan_tier) }
    let(:plan) { create(:plan, plan_tier: tier) }

    before do
      create(:tier_limit, plan_tier: tier, limit_type: "requests_per_month", limit: 1_000_000)
    end

    it "aliases tier_limits as limits" do
      expect(plan.limits.count).to eq(1)
    end
  end
end
