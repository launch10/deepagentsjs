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

        # Only 3 days of data (just launched)
        dates = date_range(3)

        generate_new_account_data(project, dates)

        # Run actual analytics services
        compute_metrics_for_project(project, dates)

        # Generate insights
        generate_insights(account)

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
        performance = dates.map.with_index do |date, i|
          lead_count = leads_per_day[date] || 0
          {
            date: date,
            impressions: rand(100..200),    # Still ramping up
            clicks: rand(5..12),
            cost_micros: rand(10..20) * 1_000_000,
            conversions: lead_count.to_f,
            conversion_value_micros: lead_count * rand(50..100) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_insights(account)
        dashboard_service = ::Analytics::DashboardService.new(account, days: 30)
        metrics_summary = ::Analytics::InsightsMetricsService.new(dashboard_service).summary

        project = account.projects.first

        DashboardInsight.create!(
          account: account,
          insights: [
            {
              title: "Campaign Just Launched",
              description: "My New Business has been running for 3 days. Early results show 3 leads - a promising start!",
              sentiment: "positive",
              project_uuid: project.uuid,
              action: { label: "View Campaign", url: "/projects/#{project.uuid}/campaigns" }
            },
            {
              title: "Building Data for Optimization",
              description: "With only 3 days of data, trends aren't yet reliable. Check back in a week for meaningful insights.",
              sentiment: "neutral",
              project_uuid: nil,
              action: { label: "Set Reminder", url: "/dashboard" }
            },
            {
              title: "Monitor Your Landing Page",
              description: "Watch for patterns in when leads come in. This will help you optimize your ad schedule.",
              sentiment: "neutral",
              project_uuid: project.uuid,
              action: { label: "View Leads", url: "/projects/#{project.uuid}/leads" }
            }
          ],
          metrics_summary: metrics_summary,
          generated_at: Time.current
        )
      end
    end
  end
end
