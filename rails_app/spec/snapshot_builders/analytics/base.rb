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
        landing_page = "https://#{website.domain}/"
        browsers = %w[Chrome Safari Firefox Edge]
        device_types = %w[Desktop Mobile Tablet]
        pages = ["/about", "/pricing", "/contact"]

        visits = []
        events_by_visit_token = {}

        visits_per_day.each do |date, visitor_count|
          visitor_count.times do
            timestamp = date.to_time + rand(0..23).hours + rand(0..59).minutes
            visit_token = SecureRandom.uuid

            visits << Ahoy::Visit.new(
              website: website,
              visit_token: visit_token,
              visitor_token: SecureRandom.uuid,
              started_at: timestamp,
              browser: browsers.sample,
              device_type: device_types.sample,
              landing_page: landing_page
            )

            # Pre-generate event data (will link after visits are imported)
            events_by_visit_token[visit_token] = rand(pages_per_visit).times.map do |i|
              {
                name: "page_view",
                time: timestamp + (i * rand(10..60)).seconds,
                properties: { page: (i == 0) ? "/" : pages.sample }
              }
            end
          end
        end

        # Bulk insert visits
        Ahoy::Visit.import(visits)

        # Fetch inserted visits to get their IDs
        visit_id_by_token = Ahoy::Visit
          .where(visit_token: events_by_visit_token.keys)
          .pluck(:visit_token, :id)
          .to_h

        # Build events with correct visit IDs
        events = events_by_visit_token.flat_map do |visit_token, event_data_list|
          visit_id = visit_id_by_token[visit_token]
          event_data_list.map do |event_data|
            Ahoy::Event.new(
              visit_id: visit_id,
              name: event_data[:name],
              time: event_data[:time],
              properties: event_data[:properties]
            )
          end
        end

        # Bulk insert events
        Ahoy::Event.import(events)
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

        leads = []
        timestamps_by_email = {}

        leads_per_day.each do |date, count|
          count.times do
            timestamp = date.to_time + rand(0..23).hours + rand(0..59).minutes
            email = "lead-#{SecureRandom.hex(4)}@example.com"

            leads << Lead.new(
              account: account,
              email: email,
              name: "Test Lead #{SecureRandom.hex(3)}",
              created_at: timestamp,
              updated_at: timestamp
            )
            timestamps_by_email[email] = timestamp
          end
        end

        return if leads.empty?

        # Bulk insert leads
        Lead.import(leads)

        # Fetch inserted leads to get their IDs
        lead_records = Lead.where(email: timestamps_by_email.keys).select(:id, :email, :created_at)

        # Build website leads with correct lead IDs
        website_leads = lead_records.map do |lead|
          WebsiteLead.new(
            lead_id: lead.id,
            website: website,
            created_at: lead.created_at,
            updated_at: lead.created_at
          )
        end

        # Bulk insert website leads
        WebsiteLead.import(website_leads)
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

      # Compute and bulk-insert AnalyticsDailyMetric records for a project.
      #
      # Uses aggregated queries instead of per-day service calls for performance.
      #
      # @param project [Project]
      # @param dates [Array<Date>]
      #
      def compute_metrics_for_project(project, dates)
        return if dates.empty?

        account = project.account
        website = project.website
        campaign_ids = project.campaigns.pluck(:id)

        # Aggregate leads by date
        leads_by_date = website ? WebsiteLead
          .where(website: website)
          .where(created_at: dates.first.beginning_of_day..dates.last.end_of_day)
          .group("DATE(created_at)")
          .count : {}

        # Aggregate unique visitors by date
        visitors_by_date = website ? Ahoy::Visit
          .where(website: website)
          .where(started_at: dates.first.beginning_of_day..dates.last.end_of_day)
          .group("DATE(started_at)")
          .count : {}

        # Aggregate page views by date
        page_views_by_date = website ? Ahoy::Event
          .joins(:visit)
          .where(ahoy_visits: { website_id: website.id })
          .where(name: "page_view")
          .where(time: dates.first.beginning_of_day..dates.last.end_of_day)
          .group("DATE(ahoy_events.time)")
          .count : {}

        # Aggregate ad metrics by date
        ads_by_date = campaign_ids.any? ? AdPerformanceDaily
          .where(campaign_id: campaign_ids, date: dates)
          .group(:date)
          .select(
            "date",
            "SUM(impressions) as impressions",
            "SUM(clicks) as clicks",
            "SUM(cost_micros) as cost_micros"
          )
          .index_by(&:date) : {}

        # Build all metric records
        now = Time.current
        records = dates.map do |date|
          ads = ads_by_date[date]
          {
            account_id: account.id,
            project_id: project.id,
            date: date,
            leads_count: leads_by_date[date.to_s] || 0,
            unique_visitors_count: visitors_by_date[date.to_s] || 0,
            page_views_count: page_views_by_date[date.to_s] || 0,
            conversion_value_cents: 0,
            impressions: ads&.impressions.to_i,
            clicks: ads&.clicks.to_i,
            cost_micros: ads&.cost_micros.to_i,
            created_at: now,
            updated_at: now
          }
        end

        # Bulk upsert all records
        AnalyticsDailyMetric.upsert_all(records, unique_by: [:account_id, :project_id, :date])
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

      # Ensure the project has a live deploy.
      #
      # Either marks an existing deploy as live, or creates one.
      #
      # @param project [Project]
      #
      def ensure_live_deploy(project)
        if project.deploys.exists?
          project.deploys.order(created_at: :desc).first.update!(status: "completed", is_live: true)
        else
          project.deploys.create!(status: "completed", is_live: true)
        end
        project.refresh_status!
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
