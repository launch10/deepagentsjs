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

    def find_project(uuid)
      @projects_cache ||= {}
      @projects_cache[uuid] ||= dashboard_service.account.projects.find_by(uuid: uuid)
    end

    def calculate_days_since_last_lead(project)
      return nil unless project&.website

      last_lead = project.website.website_leads.order(created_at: :desc).first
      return nil unless last_lead

      (Date.current - last_lead.created_at.to_date).to_i
    end

    def calculate_project_spend(project)
      return nil unless project

      # Sum cost_micros from analytics_daily_metrics and convert to dollars
      start_date = dashboard_service.days.days.ago.to_date
      cost_micros = AnalyticsDailyMetric
        .where(project: project)
        .where(date: start_date..Date.current)
        .sum(:cost_micros)

      return nil if cost_micros.zero?

      (cost_micros / 1_000_000.0).round(2)
    end

    def calculate_total_spend
      start_date = dashboard_service.days.days.ago.to_date
      cost_micros = AnalyticsDailyMetric
        .for_account(dashboard_service.account)
        .where(date: start_date..Date.current)
        .sum(:cost_micros)

      return nil if cost_micros.zero?

      (cost_micros / 1_000_000.0).round(2)
    end
  end
end
