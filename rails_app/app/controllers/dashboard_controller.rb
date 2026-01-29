# frozen_string_literal: true

class DashboardController < SubscribedController
  VALID_DATE_RANGES = [7, 30, 90].freeze
  DEFAULT_DAYS = 30

  def show
    days = parse_days_param
    status_filter = params[:status] || "all"

    dashboard_service = Analytics::DashboardService.new(
      current_account,
      days: days,
      status_filter: status_filter
    )

    # Handle regenerate_insights request
    if params[:regenerate_insights].present?
      mark_insights_stale
    end

    insight = current_account.dashboard_insight

    render inertia: "Dashboard", props: {
      performance: dashboard_service.performance_overview,
      projects: dashboard_service.projects_summary,
      status_counts: dashboard_service.status_counts,
      date_range: date_range_label(days),
      days: days,
      status_filter: status_filter,
      date_range_options: date_range_options,
      # Include insights if fresh, otherwise metrics_summary for generation
      insights: insight&.fresh? ? insight.insights : nil,
      metrics_summary: (insight&.stale? || insight.nil?) ? insights_metrics_summary(dashboard_service) : nil
    }
  end

  private

  def parse_days_param
    days = params[:days].to_i
    VALID_DATE_RANGES.include?(days) ? days : DEFAULT_DAYS
  end

  def date_range_label(days)
    "Last #{days} Days"
  end

  def date_range_options
    VALID_DATE_RANGES.map do |days|
      { label: "Last #{days} Days", days: days }
    end
  end

  def mark_insights_stale
    insight = current_account.dashboard_insight
    insight&.update!(generated_at: 1.year.ago)
  end

  def insights_metrics_summary(dashboard_service)
    Analytics::InsightsMetricsService.new(dashboard_service).summary
  end
end
