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

        expect(result[:summary][:ad_spend]).to eq(0.0)
        expect(result[:summary][:leads]).to eq(0)
        expect(result[:summary][:cpl]).to be_nil
        expect(result[:summary][:roas]).to be_nil
        expect(result[:summary][:ad_spend_trend]).to eq({ direction: "flat", percent: 0.0 })
        expect(result[:summary][:leads_trend]).to eq({ direction: "flat", percent: 0.0 })
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

    describe "trend calculations" do
      let(:service) { described_class.new(project, days: 7) }

      context "when current period is higher than previous" do
        before do
          # Previous period (8-14 days ago): 100 impressions/day
          (8..14).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 100,
              clicks: 10)
          end

          # Current period (1-7 days ago): 200 impressions/day
          (1..7).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 200,
              clicks: 20)
          end
        end

        it "shows 'up' trend direction for impressions" do
          result = service.metrics
          expect(result[:impressions][:totals][:trend_direction]).to eq("up")
        end

        it "calculates correct trend percentage" do
          result = service.metrics
          # Current: 1400 (200*7), Previous: 700 (100*7), Change: 100%
          expect(result[:impressions][:totals][:trend_percent]).to eq(100.0)
        end
      end

      context "when current period is lower than previous" do
        before do
          # Previous period: 200 impressions/day
          (8..14).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 200)
          end

          # Current period: 100 impressions/day
          (1..7).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 100)
          end
        end

        it "shows 'down' trend direction" do
          result = service.metrics
          expect(result[:impressions][:totals][:trend_direction]).to eq("down")
        end

        it "calculates correct percentage (absolute value)" do
          result = service.metrics
          # Current: 700, Previous: 1400, Change: -50%
          expect(result[:impressions][:totals][:trend_percent]).to eq(50.0)
        end
      end

      context "when no previous period data exists" do
        before do
          # Only current period data
          (1..7).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 100)
          end
        end

        it "shows 'up' trend direction (having data is better than none)" do
          result = service.metrics
          expect(result[:impressions][:totals][:trend_direction]).to eq("up")
        end

        it "shows 0 trend percent" do
          result = service.metrics
          expect(result[:impressions][:totals][:trend_percent]).to eq(0.0)
        end
      end

      context "CTR trend calculation" do
        before do
          # Previous period: CTR = 5% (50/1000)
          (8..14).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 1000,
              clicks: 50)
          end

          # Current period: CTR = 10% (100/1000)
          (1..7).each do |i|
            create(:analytics_daily_metric,
              account: account,
              project: project,
              date: i.days.ago.to_date,
              impressions: 1000,
              clicks: 100)
          end
        end

        it "calculates CTR trend correctly" do
          result = service.metrics
          expect(result[:ctr][:totals][:current]).to eq(0.1)
          # Previous CTR: 350/7000 = 0.05
          expect(result[:ctr][:totals][:previous]).to be_within(0.001).of(0.05)
          expect(result[:ctr][:totals][:trend_direction]).to eq("up")
        end
      end
    end
  end
end
