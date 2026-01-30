# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::ProjectPerformanceService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:service) { described_class.new(project, days: 30) }

  describe "#metrics" do
    context "when no data exists" do
      it "returns zeroed summary" do
        result = service.metrics

        expect(result[:summary]).to eq({
          ad_spend: 0.0,
          leads: 0,
          cpl: nil,
          roas: nil
        })
      end

      it "returns empty time series with correct dates" do
        result = service.metrics

        expect(result[:impressions][:dates].length).to eq(31) # 30 days + today
        expect(result[:impressions][:data]).to all(eq(0))
      end
    end

    context "with analytics data" do
      before do
        # Create metrics for the past 7 days
        7.times do |i|
          create(:analytics_daily_metric,
            account: account,
            project: project,
            date: i.days.ago.to_date,
            impressions: 1000,
            clicks: 100,
            cost_micros: 10_000_000, # $10
            leads_count: 5,
            conversion_value_cents: 5000) # $50
        end
      end

      it "calculates summary correctly" do
        result = service.metrics

        # 7 days * $10 = $70 ad spend
        expect(result[:summary][:ad_spend]).to eq(70.0)

        # 7 days * 5 leads = 35 leads
        expect(result[:summary][:leads]).to eq(35)

        # $70 / 35 leads = $2 CPL
        expect(result[:summary][:cpl]).to eq(2.0)

        # $350 conversion value / $70 ad spend = 5.0x ROAS
        expect(result[:summary][:roas]).to eq(5.0)
      end

      it "builds impressions time series" do
        result = service.metrics

        # Should have data for the past 7 days
        impressions_data = result[:impressions][:data]
        non_zero_days = impressions_data.count { |v| v > 0 }

        expect(non_zero_days).to eq(7)
        expect(result[:impressions][:totals][:current]).to eq(7000)
      end

      it "builds clicks time series" do
        result = service.metrics

        clicks_data = result[:clicks][:data]
        non_zero_days = clicks_data.count { |v| v > 0 }

        expect(non_zero_days).to eq(7)
        expect(result[:clicks][:totals][:current]).to eq(700)
      end

      it "builds CTR time series" do
        result = service.metrics

        # CTR = 100/1000 = 0.1 = 10%
        ctr_data = result[:ctr][:data]
        non_zero_days = ctr_data.count { |v| v > 0 }

        expect(non_zero_days).to eq(7)
        expect(result[:ctr][:totals][:current]).to eq(0.1)
      end
    end

    context "with different date ranges" do
      before do
        # Create metrics for different periods
        (1..90).each do |i|
          create(:analytics_daily_metric,
            account: account,
            project: project,
            date: i.days.ago.to_date,
            impressions: 100,
            clicks: 10,
            leads_count: 1,
            cost_micros: 1_000_000) # $1
        end
      end

      it "filters by 7 days" do
        service = described_class.new(project, days: 7)
        result = service.metrics

        expect(result[:summary][:leads]).to eq(7)
        expect(result[:summary][:ad_spend]).to eq(7.0)
      end

      it "filters by 90 days" do
        service = described_class.new(project, days: 90)
        result = service.metrics

        expect(result[:summary][:leads]).to eq(90)
        expect(result[:summary][:ad_spend]).to eq(90.0)
      end
    end
  end
end
