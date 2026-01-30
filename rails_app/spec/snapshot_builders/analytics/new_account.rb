# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Analytics
    # New account that just started - minimal data.
    #
    # Scenario:
    # - 1 project, just launched 3 days ago
    # - Only 3 days of data
    # - 2-3 leads so far
    # - Not enough data for meaningful trends
    # - Insights should acknowledge the early stage
    #
    # Use for: Testing edge cases with minimal data,
    #          early-stage account insights
    #
    class NewAccount < Base
      def base_snapshot
        "website_deployed"
      end

      def output_name
        "analytics/new_account"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        project = account.projects.first
        raise "No project found" unless project

        ensure_ads_account(account)

        project.update!(name: "My New Business")
        ensure_campaign(project)
        ensure_live_deploy(project)

        # Only 3 days of data (just launched)
        dates = date_range(3)

        generate_new_account_data(project, dates)

        # Run actual analytics services
        compute_metrics_for_project(project, dates)

        puts "Created analytics/new_account snapshot"
        puts "  - 1 project (just started)"
        puts "  - 3 days of data"
        puts "  - #{WebsiteLead.count} leads"
      end

      private

      def ensure_campaign(project)
        if project.campaigns.empty?
          create_analytics_campaign(project, status: "active")
        else
          # Just launched 3 days ago
          project.campaigns.update_all(status: "active", launched_at: 3.days.ago)
        end
      end

      def generate_new_account_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # A few leads - promising start
        leads_per_day = {
          dates[0] => 1,
          dates[1] => 0,
          dates[2] => 2
        }
        create_leads(website, leads_per_day)

        # Limited ad performance data
        clicks_per_day = {}
        performance = dates.map.with_index do |date, i|
          lead_count = leads_per_day[date] || 0
          clicks = rand(5..12)
          clicks_per_day[date] = clicks
          {
            date: date,
            impressions: rand(100..200),    # Still ramping up
            clicks: clicks,
            cost_micros: rand(10..20) * 1_000_000,
            conversions: lead_count.to_f,
            conversion_value_micros: lead_count * rand(50..100) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)

        # Page views: early traffic
        visits_per_day = clicks_per_day.transform_values { |clicks| (clicks * rand(0.8..0.95)).round }
        create_page_views(website, visits_per_day)
      end
    end
  end
end
