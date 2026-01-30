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

    context "with historical analytics data (before today)" do
      before do
        # Create metrics for past 7 days (1-7 days ago, NOT today)
        (1..7).each do |i|
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

      it "calculates summary correctly from historical data" do
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

    context "with live data for today" do
      let!(:campaign) { create(:campaign, project: project) }
      let!(:website) { create(:website, project: project, account: account) }

      before do
        # Create live ads data for today
        create(:ad_performance_daily,
          campaign: campaign,
          date: Date.current,
          impressions: 500,
          clicks: 50,
          cost_micros: 5_000_000) # $5

        # Create live leads for today
        create(:website_lead, website: website, created_at: Time.current)
        create(:website_lead, website: website, created_at: Time.current)
      end

      it "includes today's live ads data in summary" do
        result = service.metrics

        expect(result[:summary][:ad_spend]).to eq(5.0)
      end

      it "includes today's live leads in summary" do
        result = service.metrics

        expect(result[:summary][:leads]).to eq(2)
      end

      it "includes today's data in time series" do
        result = service.metrics

        # Today should be the last element in the data array
        today_impressions = result[:impressions][:data].last
        expect(today_impressions).to eq(500)

        today_clicks = result[:clicks][:data].last
        expect(today_clicks).to eq(50)
      end
    end

    context "with combined historical and live data" do
      let!(:campaign) { create(:campaign, project: project) }
      let!(:website) { create(:website, project: project, account: account) }

      before do
        # Historical data (yesterday)
        create(:analytics_daily_metric,
          account: account,
          project: project,
          date: 1.day.ago.to_date,
          impressions: 1000,
          clicks: 100,
          cost_micros: 10_000_000, # $10
          leads_count: 5)

        # Live data for today
        create(:ad_performance_daily,
          campaign: campaign,
          date: Date.current,
          impressions: 500,
          clicks: 50,
          cost_micros: 5_000_000) # $5

        create(:website_lead, website: website, created_at: Time.current)
      end

      it "combines historical and live data correctly" do
        result = service.metrics

        # $10 (yesterday) + $5 (today) = $15
        expect(result[:summary][:ad_spend]).to eq(15.0)

        # 5 (yesterday) + 1 (today) = 6
        expect(result[:summary][:leads]).to eq(6)

        # 1000 + 500 = 1500 impressions total
        expect(result[:impressions][:totals][:current]).to eq(1500)
      end
    end

    context "with different date ranges" do
      before do
        # Create metrics for different periods (starting from 1 day ago)
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

        # 7 days of historical data (no live data for today)
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

    describe "date boundary - no double counting" do
      let!(:campaign) { create(:campaign, project: project) }
      let!(:website) { create(:website, project: project, account: account) }

      context "when data exists at the boundary (yesterday + today)" do
        before do
          # Yesterday's pre-computed data
          create(:analytics_daily_metric,
            account: account,
            project: project,
            date: Date.yesterday,
            impressions: 1000,
            clicks: 100,
            cost_micros: 10_000_000, # $10
            leads_count: 5,
            conversion_value_cents: 5000)

          # Today's live data
          create(:ad_performance_daily,
            campaign: campaign,
            date: Date.current,
            impressions: 500,
            clicks: 50,
            cost_micros: 5_000_000) # $5

          3.times { create(:website_lead, website: website, created_at: Time.current) }
        end

        it "counts yesterday exactly once (from historical)" do
          result = service.metrics

          # Yesterday: 1000 impressions, Today: 500 impressions = 1500 total
          expect(result[:impressions][:totals][:current]).to eq(1500)
        end

        it "counts today exactly once (from live)" do
          result = service.metrics

          # Yesterday: 5 leads, Today: 3 leads = 8 total
          expect(result[:summary][:leads]).to eq(8)
        end

        it "sums ad spend correctly across boundary" do
          result = service.metrics

          # Yesterday: $10, Today: $5 = $15 total
          expect(result[:summary][:ad_spend]).to eq(15.0)
        end
      end

      context "when analytics_daily_metric exists for today (should be ignored)" do
        before do
          # This should NOT happen in production, but if it does,
          # we should NOT double-count it
          create(:analytics_daily_metric,
            account: account,
            project: project,
            date: Date.current, # Today - should be excluded from historical query
            impressions: 9999,
            clicks: 999,
            cost_micros: 99_000_000,
            leads_count: 99)

          # Today's actual live data
          create(:ad_performance_daily,
            campaign: campaign,
            date: Date.current,
            impressions: 100,
            clicks: 10,
            cost_micros: 1_000_000) # $1

          create(:website_lead, website: website, created_at: Time.current)
        end

        it "ignores analytics_daily_metric for today, uses only live data" do
          result = service.metrics

          # Should use live data (100 impressions), NOT the analytics_daily_metric (9999)
          expect(result[:impressions][:totals][:current]).to eq(100)
          expect(result[:clicks][:totals][:current]).to eq(10)
          expect(result[:summary][:ad_spend]).to eq(1.0)
          expect(result[:summary][:leads]).to eq(1)
        end
      end

      context "when live source tables have no data for today" do
        before do
          # Only historical data exists
          create(:analytics_daily_metric,
            account: account,
            project: project,
            date: Date.yesterday,
            impressions: 1000,
            clicks: 100,
            cost_micros: 10_000_000,
            leads_count: 5)

          # No ad_performance_daily for today
          # No website_leads for today
        end

        it "shows only historical data with zero for today" do
          result = service.metrics

          # Only yesterday's data
          expect(result[:impressions][:totals][:current]).to eq(1000)
          expect(result[:summary][:leads]).to eq(5)

          # Today's slot in time series should be 0
          today_impressions = result[:impressions][:data].last
          expect(today_impressions).to eq(0)
        end
      end

      context "time series data points are mutually exclusive" do
        before do
          # Create data for 3 consecutive days
          create(:analytics_daily_metric,
            account: account, project: project,
            date: 2.days.ago.to_date,
            impressions: 100)

          create(:analytics_daily_metric,
            account: account, project: project,
            date: Date.yesterday,
            impressions: 200)

          create(:ad_performance_daily,
            campaign: campaign,
            date: Date.current,
            impressions: 300)
        end

        it "each date has exactly one data point" do
          service = described_class.new(project, days: 3)
          result = service.metrics

          data = result[:impressions][:data]
          dates = result[:impressions][:dates]

          # Find indices for our specific dates
          idx_2_days_ago = dates.index(2.days.ago.to_date.iso8601)
          idx_yesterday = dates.index(Date.yesterday.iso8601)
          idx_today = dates.index(Date.current.iso8601)

          expect(data[idx_2_days_ago]).to eq(100)
          expect(data[idx_yesterday]).to eq(200)
          expect(data[idx_today]).to eq(300)

          # Total should be exactly 600
          expect(result[:impressions][:totals][:current]).to eq(600)
        end
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
