# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Analytics
    # Struggling account burning money with no results.
    #
    # Scenario:
    # - 1 project with active campaign
    # - 0 leads over 30 days
    # - $320+ spent with nothing to show
    # - Declining page views and CTR
    # - Low CTR (~0.8%), no CPL (can't calculate with 0 leads)
    #
    # Use for: Testing insights for accounts that need help,
    #          edge case handling when metrics are all negative
    #
    class StrugglingAccount < Base
      def base_snapshot
        "website_deployed"
      end

      def output_name
        "analytics/struggling_account"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        project = account.projects.first
        raise "No project found" unless project

        ensure_ads_account(account)

        project.update!(name: "My First Startup")
        ensure_campaign(project)

        dates = date_range(30)

        # Generate raw data - spending money but getting nothing
        generate_struggling_data(project, dates)

        # Run actual analytics services
        compute_metrics_for_project(project, dates)

        puts "Created analytics/struggling_account snapshot"
        puts "  - 1 project"
        puts "  - 0 leads"
        puts "  - $#{(AdPerformanceDaily.sum(:cost_micros) / 1_000_000.0).round(2)} spent"
        puts "  - #{AnalyticsDailyMetric.count} daily metrics computed"
      end

      private

      def ensure_campaign(project)
        if project.campaigns.empty?
          create_analytics_campaign(project, status: "active")
        else
          project.campaigns.update_all(status: "active", launched_at: 30.days.ago)
        end
      end

      def generate_struggling_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # NO leads at all
        # (don't call create_leads)

        # Ad performance: low CTR, declining impressions, money being spent
        clicks_per_day = {}
        performance = dates.map.with_index do |date, i|
          # Declining trend
          decline = 1.0 - (i * 0.01)
          clicks = (rand(1..4) * decline).round
          clicks_per_day[date] = clicks
          {
            date: date,
            impressions: (rand(200..350) * decline).round,
            clicks: clicks,  # Terrible CTR ~0.8%
            cost_micros: rand(8..14) * 1_000_000,  # Still spending $8-14/day
            conversions: 0.0,
            conversion_value_micros: 0
          }
        end
        create_ad_performance(campaign, performance)

        # Page views: declining, proportional to clicks
        visits_per_day = clicks_per_day.transform_values { |clicks| (clicks * rand(0.7..0.9)).round.clamp(1, 100) }
        create_page_views(website, visits_per_day)
      end
    end
  end
end
