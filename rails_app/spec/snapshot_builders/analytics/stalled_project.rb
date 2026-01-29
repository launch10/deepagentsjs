# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Analytics
    # Account with one stalled project among healthy ones.
    #
    # Scenario:
    # - 3 projects total
    # - 2 healthy projects generating leads
    # - 1 project that USED to generate leads but stopped 14+ days ago
    # - Overall account looks okay, but one project needs attention
    #
    # Use for: Testing "stalled project" detection in insights,
    #          mixed performance scenarios
    #
    class StalledProject < Base
      def base_snapshot
        "website_deployed"
      end

      def output_name
        "analytics/stalled_project"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        primary_project = account.projects.first
        raise "No project found" unless primary_project

        ensure_ads_account(account)

        # Rename existing project - this will be the stalled one
        primary_project.update!(name: "Budget Travel Guides")
        ensure_campaign(primary_project)

        # Create additional healthy projects
        healthy_project1 = create_analytics_project(account, "Premium Pet Portraits", campaign_status: "active")
        healthy_project2 = create_analytics_project(account, "Fitness Coaching", campaign_status: "active")

        projects = [primary_project, healthy_project1, healthy_project2]
        dates = date_range(30)

        # Generate data - stalled project had leads early but stopped
        generate_stalled_project_data(primary_project, dates)
        generate_healthy_project_data(healthy_project1, dates)
        generate_healthy_project_data(healthy_project2, dates)

        # Run actual analytics services
        projects.each do |project|
          compute_metrics_for_project(project, dates)
        end

        # Generate insights
        generate_insights(account, primary_project)

        puts "Created analytics/stalled_project snapshot"
        puts "  - #{projects.count} projects (1 stalled)"
        puts "  - #{WebsiteLead.count} total leads"
        puts "  - Stalled project last lead: 14+ days ago"
      end

      private

      def ensure_campaign(project)
        if project.campaigns.empty?
          create_analytics_campaign(project, status: "active")
        else
          project.campaigns.update_all(status: "active", launched_at: 30.days.ago)
        end
      end

      def generate_stalled_project_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # HAD leads in first 2 weeks, then stopped completely
        leads_per_day = dates.each_with_object({}) do |date, hash|
          days_ago = (Date.current - date).to_i
          # Leads only 14+ days ago
          hash[date] = days_ago >= 14 ? rand(0..2) : 0
        end
        create_leads(website, leads_per_day)

        # Ad performance: still spending money, decent impressions
        performance = dates.map do |date|
          days_ago = (Date.current - date).to_i
          {
            date: date,
            impressions: rand(250..400),
            clicks: rand(8..15),
            cost_micros: rand(6..10) * 1_000_000, # Still spending $6-10/day
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(60..100) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_healthy_project_data(project, dates)
        website = project.website
        campaign = project.campaigns.first

        # Consistent lead generation
        leads_per_day = dates.each_with_object({}) do |date, hash|
          hash[date] = rand(0..2)
        end
        create_leads(website, leads_per_day)

        # Good ad performance
        performance = dates.map do |date|
          {
            date: date,
            impressions: rand(350..550),
            clicks: rand(15..30),
            cost_micros: rand(10..16) * 1_000_000,
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(70..110) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)
      end

      def generate_insights(account, stalled_project)
        dashboard_service = ::Analytics::DashboardService.new(account, days: 30)
        metrics_summary = ::Analytics::InsightsMetricsService.new(dashboard_service).summary

        healthy_project = account.projects.find_by(name: "Premium Pet Portraits")

        DashboardInsight.create!(
          account: account,
          insights: [
            {
              title: "Lead Generation Stalled",
              description: "Budget Travel Guides hasn't generated leads in 14 days despite spending $187. Consider reviewing your targeting or ad copy.",
              sentiment: "negative",
              project_uuid: stalled_project.uuid,
              action: { label: "Review Keywords", url: "/projects/#{stalled_project.uuid}/campaigns/keywords" }
            },
            {
              title: "Premium Pet Portraits Performing Well",
              description: "This project continues to generate consistent leads with a healthy CPL. Consider scaling the budget.",
              sentiment: "positive",
              project_uuid: healthy_project&.uuid,
              action: { label: "Increase Budget", url: "/projects/#{healthy_project&.uuid}/campaigns/budget" }
            },
            {
              title: "Overall Account Health: Good",
              description: "2 of 3 projects are performing well. Focus attention on Budget Travel Guides to improve overall returns.",
              sentiment: "neutral",
              project_uuid: nil,
              action: { label: "View Dashboard", url: "/dashboard" }
            }
          ],
          metrics_summary: metrics_summary,
          generated_at: Time.current
        )
      end
    end
  end
end
