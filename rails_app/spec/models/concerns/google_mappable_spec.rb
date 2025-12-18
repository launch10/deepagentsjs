require "rails_helper"

RSpec.describe GoogleMappable do
  describe AdBudget do
    let(:campaign) { create(:campaign) }
    let(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }

    describe "#to_google_json" do
      it "converts daily_budget_cents to amount_micros" do
        result = budget.to_google_json
        expect(result[:amount_micros]).to eq(5_000_000)
      end
    end

    describe ".from_google_json" do
      it "converts amount_micros to daily_budget_cents" do
        result = AdBudget.from_google_json({ amount_micros: 5_000_000 })
        expect(result[:daily_budget_cents]).to eq(500)
      end

      it "handles Google API response objects" do
        google_budget = double("CampaignBudget", amount_micros: 10_000_000)
        result = AdBudget.from_google_json(google_budget)
        expect(result[:daily_budget_cents]).to eq(1000)
      end
    end
  end

  describe Campaign do
    let(:campaign) { create(:campaign, name: "Test Campaign", status: "draft") }

    describe "#to_google_json" do
      it "maps campaign fields" do
        result = campaign.to_google_json
        expect(result[:name]).to eq("Test Campaign")
        expect(result[:status]).to eq("draft")
      end
    end

    describe ".from_google_json" do
      it "converts Google campaign to our format" do
        result = Campaign.from_google_json({
          name: "Google Campaign",
          status: :PAUSED,
          advertising_channel_type: :SEARCH,
          bidding_strategy_type: :MANUAL_CPC
        })
        expect(result[:name]).to eq("Google Campaign")
        expect(result[:status]).to eq(:PAUSED)
        expect(result[:advertising_channel_type]).to eq(:SEARCH)
        expect(result[:bidding_strategy_type]).to eq(:MANUAL_CPC)
      end
    end
  end

  describe AdGroup do
    let(:campaign) { create(:campaign) }
    let(:ad_group) { create(:ad_group, campaign: campaign, name: "Test Ad Group") }

    describe "#to_google_json" do
      it "maps ad group fields" do
        result = ad_group.to_google_json
        expect(result[:name]).to eq("Test Ad Group")
      end
    end

    describe ".from_google_json" do
      it "converts cpc_bid_micros to cpc_bid_cents" do
        result = AdGroup.from_google_json({
          name: "Google Ad Group",
          status: :ENABLED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 2_500_000
        })
        expect(result[:name]).to eq("Google Ad Group")
        expect(result[:cpc_bid_cents]).to eq(250)
      end
    end
  end
end
