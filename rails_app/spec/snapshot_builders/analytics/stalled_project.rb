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
          hash[date] = (days_ago >= 14) ? rand(0..2) : 0
        end
        create_leads(website, leads_per_day)

        # Ad performance: still spending money, decent impressions
        clicks_per_day = {}
        performance = dates.map do |date|
          clicks = rand(8..15)
          clicks_per_day[date] = clicks
          {
            date: date,
            impressions: rand(250..400),
            clicks: clicks,
            cost_micros: rand(6..10) * 1_000_000, # Still spending $6-10/day
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(60..100) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)

        # Page views: still getting traffic but no conversions
        visits_per_day = clicks_per_day.transform_values { |clicks| (clicks * rand(0.8..0.95)).round }
        create_page_views(website, visits_per_day)
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
        clicks_per_day = {}
        performance = dates.map do |date|
          clicks = rand(15..30)
          clicks_per_day[date] = clicks
          {
            date: date,
            impressions: rand(350..550),
            clicks: clicks,
            cost_micros: rand(10..16) * 1_000_000,
            conversions: leads_per_day[date].to_f,
            conversion_value_micros: leads_per_day[date] * rand(70..110) * 1_000_000
          }
        end
        create_ad_performance(campaign, performance)

        # Page views: healthy traffic
        visits_per_day = clicks_per_day.transform_values { |clicks| (clicks * rand(0.8..0.95)).round }
        create_page_views(website, visits_per_day)
      end
    end
  end
end
