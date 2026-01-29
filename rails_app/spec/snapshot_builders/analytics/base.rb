# frozen_string_literal: true

require_relative "../base_builder"

module SnapshotBuilders
  module Analytics
    # Base class for analytics snapshot builders.
    #
    # Provides helpers to:
    # - Create raw source data (leads, ad performance)
    # - Run actual analytics services to compute metrics
    # - Set up realistic scenarios for dashboard/insights testing
    #
    class Base < ::BaseBuilder
      private

      # Create Ahoy visits and page_view events for a website.
      #
      # Generates realistic traffic data where page views > unique visitors
      # (each visitor views 1-3 pages on average).
      #
      # @param website [Website]
      # @param visits_per_day [Hash<Date, Integer>] date => unique visitor count
      # @param pages_per_visit [Range] how many page views per visit (default 1..3)
      #
      def create_page_views(website, visits_per_day, pages_per_visit: 1..3)
        visits_per_day.each do |date, visitor_count|
          visitor_count.times do
            timestamp = date.to_time + rand(0..23).hours + rand(0..59).minutes

            # Create the visit (unique visitor)
            visit = Ahoy::Visit.create!(
              website: website,
              visit_token: SecureRandom.uuid,
              visitor_token: SecureRandom.uuid,
              started_at: timestamp,
              browser: %w[Chrome Safari Firefox Edge].sample,
              device_type: %w[Desktop Mobile Tablet].sample,
              landing_page: "https://#{website.domains.first&.domain || "example.com"}/"
            )

            # Create page_view events (1-3 per visit)
            rand(pages_per_visit).times do |i|
              Ahoy::Event.create!(
                visit: visit,
                name: "page_view",
                time: timestamp + (i * rand(10..60)).seconds,
                properties: { page: (i == 0) ? "/" : ["/about", "/pricing", "/contact"].sample }
              )
            end
          end
        end
      end

      # Create website leads for a project on specific dates.
      #
      # Creates both Lead (account-level) and WebsiteLead (join table) records.
      #
      # @param website [Website]
      # @param leads_per_day [Hash<Date, Integer>] date => count mapping
      #
      def create_leads(website, leads_per_day)
        account = website.account

        leads_per_day.each do |date, count|
          count.times do
            timestamp = date.to_time + rand(0..23).hours + rand(0..59).minutes

            # Create the Lead (account-level record with email)
            lead = Lead.create!(
              account: account,
              email: "lead-#{SecureRandom.hex(4)}@example.com",
              name: "Test Lead #{SecureRandom.hex(3)}",
              created_at: timestamp,
              updated_at: timestamp
            )

            # Create the WebsiteLead (join table linking to website)
            WebsiteLead.create!(
              lead: lead,
              website: website,
              created_at: timestamp,
              updated_at: timestamp
            )
          end
        end
      end

      # Create ad performance records (raw Google Ads data).
      #
      # @param campaign [Campaign]
      # @param performance_data [Array<Hash>] array of daily performance hashes
      #
      def create_ad_performance(campaign, performance_data)
        records = performance_data.map do |data|
          AdPerformanceDaily.new(
            campaign: campaign,
            date: data[:date],
            impressions: data[:impressions] || 0,
            clicks: data[:clicks] || 0,
            cost_micros: data[:cost_micros] || 0,
            conversions: data[:conversions] || 0.0,
            conversion_value_micros: data[:conversion_value_micros] || 0
          )
        end

        AdPerformanceDaily.import(records)
      end

      # Run the actual ComputeMetricsService to generate AnalyticsDailyMetric.
      #
      # This ensures the computed metrics match production behavior.
      #
      # @param project [Project]
      # @param dates [Array<Date>]
      #
      def compute_metrics_for_project(project, dates)
        dates.each do |date|
          ::Analytics::ComputeMetricsService.new(project, date: date).call
        end
      end

      # Create a project with website, optionally with campaign and deploy.
      #
      # @param account [Account]
      # @param name [String]
      # @param with_campaign [Boolean]
      # @param with_deploy [Boolean]
      # @param campaign_status [String, nil]
      # @return [Project]
      #
      def create_analytics_project(account, name, with_campaign: true, with_deploy: true, campaign_status: "active")
        project = account.projects.create!(name: name)

        # Create workflow
        project.workflows.create!(workflow_type: "launch", step: with_deploy ? "ads" : "website", substep: 0)

        # Create website
        Website.create!(
          account: account,
          project: project,
          name: name,
          theme: Theme.first || create(:theme),
          template: Template.first || create(:template)
        )

        # Create deploy if needed
        if with_deploy
          project.deploys.create!(
            status: "completed",
            is_live: true
          )
        end

        # Create campaign if needed
        if with_campaign && campaign_status
          create_analytics_campaign(project, status: campaign_status)
        end

        project
      end

      # Create a campaign with budget for a project.
      #
      # @param project [Project]
      # @param status [String]
      # @return [Campaign]
      #
      def create_analytics_campaign(project, status: "active")
        result = Campaign.create_campaign!(project.account, {
          name: "#{project.name} Campaign",
          project_id: project.id,
          website_id: project.website.id
        })

        campaign = result[:campaign]
        campaign.update_columns(
          status: status,
          launched_at: (status == "active") ? 30.days.ago : nil
        )

        campaign.create_budget!(daily_budget_cents: rand(2000..5000)) unless campaign.budget

        # Create ads account if needed
        ensure_ads_account(project.account)

        campaign
      end

      # Clear all analytics-related data for a project.
      #
      # Use this when a snapshot builder extends a base snapshot that
      # already has analytics data, and you want to replace it with
      # different data (e.g., making a project "stalled").
      #
      # @param project [Project]
      #
      def clear_project_analytics_data(project)
        website = project.website
        return unless website

        # Clear leads (both WebsiteLead join records and Lead records)
        lead_ids = website.website_leads.pluck(:lead_id)
        website.website_leads.delete_all
        Lead.where(id: lead_ids).delete_all if lead_ids.any?

        # Clear Ahoy visits and events
        visit_ids = Ahoy::Visit.where(website: website).pluck(:id)
        Ahoy::Event.where(visit_id: visit_ids).delete_all if visit_ids.any?
        Ahoy::Visit.where(website: website).delete_all

        # Clear computed analytics metrics
        AnalyticsDailyMetric.where(project: project).delete_all

        # Clear ad performance data
        campaign_ids = project.campaigns.pluck(:id)
        AdPerformanceDaily.where(campaign_id: campaign_ids).delete_all if campaign_ids.any?
      end

      # Ensure the account has an ads account for Google Ads data.
      #
      def ensure_ads_account(account)
        return if account.ads_account.present?

        AdsAccount.create!(
          account: account,
          platform: "google",
          google_customer_id: "123-456-#{account.id.to_s.rjust(4, "0")}"
        )
      end

      # Generate a date range for the past N days.
      #
      # @param days [Integer]
      # @return [Array<Date>]
      #
      def date_range(days)
        (days.days.ago.to_date..Date.current).to_a
      end

      # Generate trending data with growth or decline.
      #
      # @param base_value [Numeric]
      # @param days [Integer]
      # @param trend [Symbol] :up, :down, or :flat
      # @param variance [Float] random variance percentage (0.0-1.0)
      # @return [Array<Numeric>]
      #
      def generate_trending_values(base_value, days, trend: :up, variance: 0.1)
        multiplier = case trend
        when :up then 1.03
        when :down then 0.97
        else 1.0
        end

        days.times.map do |day|
          value = base_value * (multiplier**day) * rand((1 - variance)..(1 + variance))
          value.round(value.is_a?(Float) ? 2 : 0)
        end
      end
    end
  end
end
