# frozen_string_literal: true

module Analytics
  # Main orchestrator for the analytics dashboard.
  #
  # Coordinates metric services and caching to provide dashboard data
  # with a target response time of <500ms.
  #
  class DashboardService
    attr_reader :account, :days, :status_filter

    # @param account [Account] The account to fetch analytics for
    # @param days [Integer] Number of days to include (default: 30)
    # @param status_filter [String] Filter projects by status ("all", "active", "paused")
    #
    def initialize(account, days: 30, status_filter: "all")
      @account = account
      @days = days
      @status_filter = status_filter
      @start_date = days.days.ago.to_date
      @end_date = Date.current
    end

    # Get performance overview with all metrics.
    #
    # @return [Hash] Performance data with :leads, :page_views, :ctr, :cpl
    #
    def performance_overview
      CacheService.fetch(account.id, "overview", days) do
        {
          leads: leads_metric.time_series,
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

    private

    def leads_metric
      @leads_metric ||= Metrics::LeadsMetric.new(account, @start_date, @end_date)
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
          "SUM(page_views_count) as total_page_views",
          "SUM(impressions) as total_impressions",
          "SUM(clicks) as total_clicks",
          "SUM(cost_micros) as total_cost_micros"
        )
        .where(account: account)
        .for_date_range(@start_date, @end_date)
        .group(:project_id)
        .index_by(&:project_id)

      # Get all projects for the account
      projects = filtered_projects

      projects.map do |project|
        metrics = projects_with_metrics[project.id]

        total_leads = metrics&.total_leads.to_i
        total_page_views = metrics&.total_page_views.to_i
        total_impressions = metrics&.total_impressions.to_i
        total_clicks = metrics&.total_clicks.to_i
        total_cost_micros = metrics&.total_cost_micros.to_i

        ctr = total_impressions > 0 ? (total_clicks.to_f / total_impressions).round(4) : nil
        cost_dollars = total_cost_micros / 1_000_000.0
        cpl = total_leads > 0 && total_cost_micros > 0 ? (cost_dollars / total_leads).round(2) : nil

        {
          id: project.id,
          uuid: project.uuid,
          name: project.name,
          total_leads: total_leads,
          total_page_views: total_page_views,
          total_impressions: total_impressions,
          total_clicks: total_clicks,
          ctr: ctr,
          cost_dollars: cost_dollars.round(2),
          cpl: cpl
        }
      end
    end

    def filtered_projects
      projects = account.projects

      case status_filter
      when "active"
        projects.joins(:campaigns).where(campaigns: { status: "active" }).distinct
      when "paused"
        projects.joins(:campaigns).where(campaigns: { status: "paused" }).distinct
      else
        projects
      end
    end
  end
end
