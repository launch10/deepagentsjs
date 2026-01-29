# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Analytics
    # Healthy account with strong performance across multiple projects.
    #
    # Scenario:
    # - 3 active projects with live deploys
    # - ~47 total leads over 30 days
    # - Good CTR (4-5%), reasonable CPL (~$18)
    # - Positive trends across all metrics
    # - One project is a "high performer" (low CPL, high leads)
    #
    # Use for: Dashboard happy path, positive insights generation
    #
    class HealthyAccount < Base
      def base_snapshot
        "website_deployed"
      end

      def output_name
        "analytics/healthy_account"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        primary_project = account.projects.first
        raise "No project found" unless primary_project

        ensure_ads_account(account)

        # Rename existing project
        primary_project.update!(name: "Premium Pet Portraits")
        ensure_campaign(primary_project)

        # Create additional projects
        project2 = create_analytics_project(account, "Budget Travel Guides", campaign_status: "active")
        project3 = create_analytics_project(account, "Fitness Coaching", campaign_status: "active")

        projects = [primary_project, project2, project3]
        dates = date_range(30)

        # Generate raw data for each project
        generate_high_performer_data(primary_project, dates)  # ~32 leads, best CPL
        generate_moderate_performer_data(project2, dates)     # ~10 leads
        generate_steady_performer_data(project3, dates)       # ~5 leads

        # Run actual analytics services to compute metrics
        projects.each do |project|
          compute_metrics_for_project(project, dates)
        end

        # Generate insights using actual service
        generate_insights(account)

        puts "Created analytics/healthy_account snapshot"
        puts "  - #{projects.count} projects"
        puts "  - #{WebsiteLead.count} total leads"
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

      def generate_high_performer_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # High performer: ~32 leads, low CPL, high CTR
        leads_per_day = dates.each_with_object({}) do |date, hash|
          # More leads in recent days (trending up)
          day_index = dates.index(date)
          base = day_index < 15 ? rand(0..1) : rand(1..2)
          hash[date] = base + (day_index > 25 ? 1 : 0)
        end
        create_leads(website, leads_per_day)

        # Ad performance: good CTR, moderate spend
        performance = dates.map.with_index do |date, i|
          trend = 1.0 + (i * 0.01) # Slight upward trend
          {
            date: date,
            impressions: (rand(400..600) * trend).round,
            clicks: (rand(20..35) * trend).round,      # ~5% CTR
            cost_micros: (rand(12..18) * 1_000_000),   # $12-18/day
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(80..120) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_moderate_performer_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # Moderate performer: ~10 leads
        leads_per_day = dates.each_with_object({}) do |date, hash|
          hash[date] = rand(0..1) # Occasional leads
        end
        create_leads(website, leads_per_day)

        # Ad performance: moderate CTR
        performance = dates.map do |date|
          {
            date: date,
            impressions: rand(300..500),
            clicks: rand(10..20),              # ~3-4% CTR
            cost_micros: rand(8..14) * 1_000_000,
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(60..100) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_steady_performer_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # Steady performer: ~5 leads, consistent
        leads_per_day = dates.each_with_object({}) do |date, hash|
          hash[date] = rand(10) < 2 ? 1 : 0 # ~20% chance of lead each day
        end
        create_leads(website, leads_per_day)

        # Ad performance: steady
        performance = dates.map do |date|
          {
            date: date,
            impressions: rand(200..350),
            clicks: rand(8..15),
            cost_micros: rand(5..10) * 1_000_000,
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(50..80) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_insights(account)
        dashboard_service = ::Analytics::DashboardService.new(account, days: 30)
        metrics_summary = ::Analytics::InsightsMetricsService.new(dashboard_service).summary

        # Create insights matching what LLM would generate for healthy account
        DashboardInsight.create!(
          account: account,
          insights: [
            {
              title: "Strong Lead Growth",
              description: "Premium Pet Portraits is outperforming with 32 leads this month at just $16.34 per lead.",
              sentiment: "positive",
              project_uuid: account.projects.find_by(name: "Premium Pet Portraits")&.uuid,
              action: { label: "View Campaign", url: "/projects/#{account.projects.first.uuid}/campaigns" }
            },
            {
              title: "CTR Improving Across Campaigns",
              description: "Your click-through rate has improved 10% this month, averaging 4.2% across all projects.",
              sentiment: "positive",
              project_uuid: nil,
              action: { label: "Review Ads", url: "/dashboard" }
            },
            {
              title: "Consider Scaling Budget Travel Guides",
              description: "With a solid CPL of $22, this project has room to scale. Consider increasing daily budget.",
              sentiment: "neutral",
              project_uuid: account.projects.find_by(name: "Budget Travel Guides")&.uuid,
              action: { label: "Adjust Budget", url: "/projects/#{account.projects.second&.uuid}/campaigns/budget" }
            }
          ],
          metrics_summary: metrics_summary,
          generated_at: Time.current
        )
      end
    end
  end
end
