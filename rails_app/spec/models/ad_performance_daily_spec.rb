# == Schema Information
#
# Table name: ad_performance_daily
#
#  id                      :bigint           not null, primary key
#  clicks                  :bigint           default(0), not null
#  conversion_value_micros :bigint           default(0), not null
#  conversions             :decimal(12, 2)   default(0.0), not null
#  cost_micros             :bigint           default(0), not null
#  date                    :date             not null
#  impressions             :bigint           default(0), not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  campaign_id             :bigint           not null
#
# Indexes
#
#  idx_ad_perf_daily_campaign_date     (campaign_id,date) UNIQUE
#  index_ad_performance_daily_on_date  (date)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_id => campaigns.id)
#
require "rails_helper"

RSpec.describe AdPerformanceDaily, type: :model do
  describe "associations" do
    it { should belong_to(:campaign) }
  end

  describe "validations" do
    let(:campaign) { create(:campaign) }
    subject { build(:ad_performance_daily, campaign: campaign) }

    it { should validate_presence_of(:campaign_id) }
    it { should validate_presence_of(:date) }
    it { should validate_uniqueness_of(:date).scoped_to(:campaign_id) }
  end

  # Core user outcome: idempotent upserts work correctly for 7-day rolling window sync
  describe "uniqueness constraint for upserts" do
    let(:campaign) { create(:campaign) }

    it "allows creating records for different dates" do
      create(:ad_performance_daily, campaign: campaign, date: Date.yesterday)
      record2 = build(:ad_performance_daily, campaign: campaign, date: 2.days.ago)
      expect(record2).to be_valid
    end

    it "prevents duplicate records for same campaign+date" do
      create(:ad_performance_daily, campaign: campaign, date: Date.yesterday)
      duplicate = build(:ad_performance_daily, campaign: campaign, date: Date.yesterday)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:date]).to include("has already been taken")
    end
  end

  describe "scopes" do
    let(:campaign) { create(:campaign) }
    let!(:yesterday) { create(:ad_performance_daily, campaign: campaign, date: Date.yesterday) }
    let!(:last_week) { create(:ad_performance_daily, campaign: campaign, date: 7.days.ago) }

    describe ".for_date_range" do
      it "returns records within the range" do
        results = described_class.for_date_range(3.days.ago, Date.current)
        expect(results).to include(yesterday)
        expect(results).not_to include(last_week)
      end
    end
  end

  # Core user outcome: computed metrics for display are correct
  describe "computed metrics" do
    let(:record) { build(:ad_performance_daily, impressions: 1000, clicks: 50, cost_micros: 25_000_000) }

    describe "#cost_dollars" do
      it "converts micros to dollars" do
        expect(record.cost_dollars).to eq(25.0)
      end
    end

    describe "#ctr" do
      it "calculates click-through rate" do
        expect(record.ctr).to eq(0.05) # 50/1000
      end

      it "returns nil when impressions is zero" do
        record.impressions = 0
        expect(record.ctr).to be_nil
      end
    end
  end
end
