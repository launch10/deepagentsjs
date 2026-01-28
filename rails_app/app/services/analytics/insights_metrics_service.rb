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
    # @return [Hash] Metrics summary with :totals, :projects, :trends
    #
    def summary
      overview = dashboard_service.performance_overview
      projects = dashboard_service.projects_summary

      {
        totals: extract_totals(overview),
        projects: extract_project_summaries(projects),
        trends: extract_trends(overview)
      }
    end

    private

    def extract_totals(overview)
      {
        leads: overview[:leads][:totals][:current],
        page_views: overview[:page_views][:totals][:current],
        ctr: overview[:ctr][:available] ? overview[:ctr][:totals][:current] : nil,
        cpl: overview[:cpl][:available] ? overview[:cpl][:totals][:current] : nil,
        ctr_available: overview[:ctr][:available],
        cpl_available: overview[:cpl][:available]
      }
    end

    def extract_project_summaries(projects)
      projects.map do |project|
        {
          uuid: project[:uuid],
          name: project[:name],
          total_leads: project[:total_leads],
          total_page_views: project[:total_page_views],
          ctr: project[:ctr],
          cpl: project[:cpl]
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
  end
end
