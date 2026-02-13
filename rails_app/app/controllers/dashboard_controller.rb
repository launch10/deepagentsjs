# frozen_string_literal: true

class DashboardController < SubscribedController
  VALID_DATE_RANGES = [7, 30, 90].freeze
  DEFAULT_DAYS = 30

  def show
    track_dashboard_viewed

    # Handle regenerate_insights request
    if params[:regenerate_insights].present?
      mark_insights_stale
    end

    insight = current_account.dashboard_insight

    # Pre-fetch all date ranges for instant client-side switching
    all_performance = {}
    all_projects = {}
    VALID_DATE_RANGES.each do |days|
      service = Analytics::DashboardService.new(current_account, days: days)
      all_performance[days] = service.performance_overview
      all_projects[days] = service.projects_summary
    end

    # Status counts don't change by date range
    status_counts = Analytics::DashboardService.new(current_account, days: DEFAULT_DAYS).status_counts

    # Ensure insights chat exists for this account
    insights_chat = current_account.find_or_create_insights_chat

    render inertia: "Dashboard", props: {
      # All date ranges pre-fetched for instant switching
      all_performance: all_performance,
      all_projects: all_projects,
      status_counts: status_counts,
      date_range_options: date_range_options,
      # Include insights if fresh, otherwise metrics_summary for generation
      insights: insight&.fresh? ? insight.insights : nil,
      metrics_summary: (insight&.stale? || insight.nil?) ? insights_metrics_summary : nil,
      # Thread ID for Langgraph insights generation
      thread_id: insights_chat.thread_id
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

  def insights_metrics_summary
    dashboard_service = Analytics::DashboardService.new(current_account, days: DEFAULT_DAYS)
    Analytics::InsightsMetricsService.new(dashboard_service).summary
  end

  def track_dashboard_viewed
    TrackEvent.call("dashboard_viewed",
      user: current_user,
      account: current_account,
      project_count: current_account.projects.count,
      live_project_count: current_account.projects.where(status: "live").count,
      has_insights: current_account.dashboard_insight&.fresh? || false
    )
  end
end
