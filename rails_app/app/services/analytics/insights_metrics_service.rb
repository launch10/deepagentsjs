# frozen_string_literal: true

module Analytics
  # Extracts and summarizes metrics for AI insight generation.
  #
  # Provides a snapshot of current metrics that can be passed to an LLM
  # to generate human-readable insights.
  #
  class InsightsMetricsService
    attr_reader :dashboard_service

    # @param dashboard_service [Analytics::DashboardService] Initialized dashboard service
    #
    def initialize(dashboard_service)
      @dashboard_service = dashboard_service
      preload_data
    end

    # Generate a summary of all metrics for AI insights.
    #
    # @return [Hash] Metrics summary with :period, :totals, :projects, :trends, :flags
    #
    def summary
      overview = dashboard_service.performance_overview
      projects = dashboard_service.projects_summary

      {
        period: "Last #{dashboard_service.days} Days",
        totals: extract_totals(overview),
        projects: extract_project_summaries(projects),
        trends: extract_trends(overview),
        flags: extract_flags(projects)
      }
    end

    private

    def extract_totals(overview)
      # Calculate total spend from projects
      total_spend = calculate_total_spend

      {
        leads: overview[:leads][:totals][:current],
        page_views: overview[:page_views][:totals][:current],
        unique_visitors: overview[:unique_visitors][:totals][:current],
        ctr: overview[:ctr][:available] ? overview[:ctr][:totals][:current] : nil,
        cpl: overview[:cpl][:available] ? overview[:cpl][:totals][:current] : nil,
        ctr_available: overview[:ctr][:available],
        cpl_available: overview[:cpl][:available],
        total_spend_dollars: total_spend
      }
    end

    def extract_project_summaries(projects)
      projects.map do |project|
        project_record = find_project(project[:uuid])
        days_since_lead = calculate_days_since_last_lead(project_record)
        spend = calculate_project_spend(project_record)

        {
          uuid: project[:uuid],
          name: project[:name],
          total_leads: project[:total_leads],
          total_page_views: project[:total_page_views],
          total_unique_visitors: project[:total_unique_visitors],
          ctr: project[:ctr],
          cpl: project[:cpl],
          days_since_last_lead: days_since_lead,
          spend_dollars: spend
        }
      end
    end

    def extract_trends(overview)
      {
        leads_trend: {
          direction: overview[:leads][:totals][:trend_direction],
          percent: overview[:leads][:totals][:trend_percent]
        },
        page_views_trend: {
          direction: overview[:page_views][:totals][:trend_direction],
          percent: overview[:page_views][:totals][:trend_percent]
        },
        unique_visitors_trend: {
          direction: overview[:unique_visitors][:totals][:trend_direction],
          percent: overview[:unique_visitors][:totals][:trend_percent]
        },
        ctr_trend: if overview[:ctr][:available]
                     {
                       direction: overview[:ctr][:totals][:trend_direction],
                       percent: overview[:ctr][:totals][:trend_percent]
                     }
                   end,
        cpl_trend: if overview[:cpl][:available]
                     {
                       direction: overview[:cpl][:totals][:trend_direction],
                       percent: overview[:cpl][:totals][:trend_percent]
                     }
                   end
      }
    end

    def extract_flags(projects)
      {
        has_stalled_project: projects.any? { |p| stalled_project?(p) },
        has_high_performer: projects.any? { |p| high_performer?(p) },
        has_new_first_lead: false # TODO: implement when tracking first lead milestone
      }
    end

    def stalled_project?(project_summary)
      project = find_project(project_summary[:uuid])
      return false unless project&.website

      days = calculate_days_since_last_lead(project)
      days.present? && days >= 7
    end

    def high_performer?(project_summary)
      # A project is high performing if it has leads and good CPL
      project_summary[:total_leads].to_i > 5 &&
        project_summary[:cpl].present? &&
        project_summary[:cpl] < average_cpl
    end

    def average_cpl
      @average_cpl ||= begin
        projects = dashboard_service.projects_summary
        cpls = projects.filter_map { |p| p[:cpl] }
        return Float::INFINITY if cpls.empty?

        cpls.sum / cpls.size
      end
    end

    # Batch-load all data upfront to avoid N+1 queries
    def preload_data
      @projects_by_uuid = dashboard_service.account.projects
        .includes(website: :website_leads)
        .index_by(&:uuid)

      preload_last_lead_dates
      preload_project_spends
    end

    # Single query to get the last lead date for all projects
    def preload_last_lead_dates
      website_ids = @projects_by_uuid.values.filter_map { |p| p.website&.id }
      return @last_lead_by_website_id = {} if website_ids.empty?

      # Get the max created_at per website_id in a single query
      @last_lead_by_website_id = WebsiteLead
        .where(website_id: website_ids)
        .group(:website_id)
        .maximum(:created_at)
    end

    # Single query to get spend per project
    def preload_project_spends
      start_date = dashboard_service.days.days.ago.to_date
      project_ids = @projects_by_uuid.values.map(&:id)

      spends = AnalyticsDailyMetric
        .where(project_id: project_ids)
        .where(date: start_date..Date.current)
        .group(:project_id)
        .sum(:cost_micros)

      @spend_by_project_id = spends.transform_values do |cost_micros|
        cost_micros.zero? ? nil : (cost_micros / 1_000_000.0).round(2)
      end

      # Also calculate total spend in same query result
      total_micros = spends.values.sum
      @total_spend = total_micros.zero? ? nil : (total_micros / 1_000_000.0).round(2)
    end

    def find_project(uuid)
      @projects_by_uuid[uuid]
    end

    def calculate_days_since_last_lead(project)
      return nil unless project&.website

      last_lead_at = @last_lead_by_website_id[project.website.id]
      return nil unless last_lead_at

      (Date.current - last_lead_at.to_date).to_i
    end

    def calculate_project_spend(project)
      return nil unless project

      @spend_by_project_id[project.id]
    end

    def calculate_total_spend
      @total_spend
    end
  end
end
