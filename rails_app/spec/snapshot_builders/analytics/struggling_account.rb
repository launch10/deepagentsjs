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

        # Generate insights using actual service
        generate_insights(account)

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
        performance = dates.map.with_index do |date, i|
          # Declining trend
          decline = 1.0 - (i * 0.01)
          {
            date: date,
            impressions: (rand(200..350) * decline).round,
            clicks: (rand(1..4) * decline).round,  # Terrible CTR ~0.8%
            cost_micros: rand(8..14) * 1_000_000,  # Still spending $8-14/day
            conversions: 0.0,
            conversion_value_micros: 0
          }
        end
        create_ad_performance(campaign, performance)

        # Create some page views via Ahoy (declining)
        dates.each_with_index do |date, i|
          decline = 1.0 - (i * 0.015)
          page_view_count = (rand(5..15) * decline).round

          page_view_count.times do
            visit = Ahoy::Visit.create!(
              visitor_token: SecureRandom.uuid,
              visit_token: SecureRandom.uuid,
              started_at: date.to_time + rand(0..23).hours
            )

            Ahoy::Event.create!(
              visit: visit,
              name: "page_view",
              time: visit.started_at + rand(1..300).seconds,
              properties: { url: "https://example.com/#{project.website.id}" }
            )
          end
        end
      end

      def generate_insights(account)
        dashboard_service = ::Analytics::DashboardService.new(account, days: 30)
        metrics_summary = ::Analytics::InsightsMetricsService.new(dashboard_service).summary

        project = account.projects.first

        # Create insights for a struggling account - still actionable
        DashboardInsight.create!(
          account: account,
          insights: [
            {
              title: "No Leads Generated",
              description: "My First Startup has spent $320 over 30 days without generating any leads. Your landing page may need optimization.",
              sentiment: "negative",
              project_uuid: project.uuid,
              action: { label: "Review Landing Page", url: "/projects/#{project.uuid}/website" }
            },
            {
              title: "Click-Through Rate Critically Low",
              description: "At 0.8% CTR, your ads aren't resonating with your audience. Consider testing new headlines and descriptions.",
              sentiment: "negative",
              project_uuid: project.uuid,
              action: { label: "Review Ad Copy", url: "/projects/#{project.uuid}/campaigns/content" }
            },
            {
              title: "Audience Targeting May Need Adjustment",
              description: "Low engagement suggests your ads may not be reaching the right people. Review your targeting settings.",
              sentiment: "neutral",
              project_uuid: project.uuid,
              action: { label: "Adjust Targeting", url: "/projects/#{project.uuid}/campaigns/targeting" }
            }
          ],
          metrics_summary: metrics_summary,
          generated_at: Time.current
        )
      end
    end
  end
end
