# frozen_string_literal: true

module Analytics
  # Main orchestrator for the analytics dashboard.
  #
  # Coordinates metric services and caching to provide dashboard data
  # with a target response time of <500ms.
  #
  # Note: Project status filtering is done client-side for instant switching.
  # The service always returns all projects.
  #
  class DashboardService
    attr_reader :account, :days

    # @param account [Account] The account to fetch analytics for
    # @param days [Integer] Number of days to include (default: 30)
    #
    def initialize(account, days: 30, **)
      @account = account
      @days = days
      @start_date = days.days.ago.to_date
      @end_date = Date.current
    end

    # Get performance overview with all metrics.
    #
    # @return [Hash] Performance data with :leads, :unique_visitors, :page_views, :ctr, :cpl
    #
    def performance_overview
      CacheService.fetch(account.id, "overview", days) do
        {
          leads: leads_metric.time_series,
          unique_visitors: unique_visitors_metric.time_series,
          page_views: page_views_metric.time_series,
          ctr: google_ads_metric.ctr_time_series,
          cpl: google_ads_metric.cpl_time_series
        }
      end
    end

    # Get summary statistics per project.
    #
    # @return [Array<Hash>] Project summaries with aggregated stats
    #
    def projects_summary
      CacheService.fetch(account.id, "projects", days) do
        build_projects_summary
      end
    end

    # Get counts of projects by status for filter tabs.
    #
    # @return [Hash] Status counts { all: N, live: N, paused: N, draft: N }
    #
    def status_counts
      counts = account.projects.group(:status).count
      {
        all: counts.values.sum,
        live: counts["live"] || 0,
        paused: counts["paused"] || 0,
        draft: counts["draft"] || 0
      }
    end

    private

    def leads_metric
      @leads_metric ||= Metrics::LeadsMetric.new(account, @start_date, @end_date)
    end

    def unique_visitors_metric
      @unique_visitors_metric ||= Metrics::UniqueVisitorsMetric.new(account, @start_date, @end_date)
    end

    def page_views_metric
      @page_views_metric ||= Metrics::PageViewsMetric.new(account, @start_date, @end_date)
    end

    def google_ads_metric
      @google_ads_metric ||= Metrics::GoogleAdsMetric.new(account, @start_date, @end_date)
    end

    def build_projects_summary
      # Single query to get all metrics aggregated by project
      projects_with_metrics = AnalyticsDailyMetric
        .select(
          "project_id",
          "SUM(leads_count) as total_leads",
          "SUM(unique_visitors_count) as total_unique_visitors",
          "SUM(page_views_count) as total_page_views",
          "SUM(impressions) as total_impressions",
          "SUM(clicks) as total_clicks",
          "SUM(cost_micros) as total_cost_micros"
        )
        .where(account: account)
        .for_date_range(@start_date, @end_date)
        .group(:project_id)
        .index_by(&:project_id)

      # Get all projects for the account with associations
      projects = account.projects.includes(website: :website_url)

      projects.map do |project|
        metrics = projects_with_metrics[project.id]

        total_leads = metrics&.total_leads.to_i
        total_unique_visitors = metrics&.total_unique_visitors.to_i
        total_page_views = metrics&.total_page_views.to_i
        total_impressions = metrics&.total_impressions.to_i
        total_clicks = metrics&.total_clicks.to_i
        total_cost_micros = metrics&.total_cost_micros.to_i

        ctr = (total_impressions > 0) ? (total_clicks.to_f / total_impressions).round(4) : nil
        cost_dollars = total_cost_micros / 1_000_000.0
        cpl = (total_leads > 0 && total_cost_micros > 0) ? (cost_dollars / total_leads).round(2) : nil

        {
          id: project.id,
          uuid: project.uuid,
          name: project.name,
          status: project_status(project),
          url: project_url(project),
          thumbnail_url: project_thumbnail_url(project),
          total_leads: total_leads,
          total_unique_visitors: total_unique_visitors,
          total_page_views: total_page_views,
          total_impressions: total_impressions,
          total_clicks: total_clicks,
          ctr: ctr,
          cost_dollars: cost_dollars.round(2),
          cpl: cpl
        }
      end
    end

    def project_status(project)
      project.status
    end

    def project_url(project)
      website_url = project.website&.website_url
      return nil unless website_url&.domain

      "https://#{website_url.domain.domain}#{website_url.path}"
    end

    def project_thumbnail_url(project)
      # TODO: Implement actual thumbnail generation
      # For now return nil, frontend will show placeholder
      nil
    end
  end
end
