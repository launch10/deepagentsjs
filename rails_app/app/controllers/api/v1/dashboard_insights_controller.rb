# frozen_string_literal: true

# Endpoint for Langgraph to manage dashboard insights.
#
# GET /api/v1/dashboard_insights - Get current insights (check freshness)
# POST /api/v1/dashboard_insights - Save generated insights
# GET /api/v1/dashboard_insights/metrics_summary - Get metrics for generation
#
class API::V1::DashboardInsightsController < API::BaseController
  # GET /api/v1/dashboard_insights
  #
  # Returns the current dashboard insight for the account (if any).
  # The response includes a `fresh` flag indicating if insights should be regenerated.
  #
  # @return [200 OK] Current insight or empty state with freshness info
  # @return [401 Unauthorized] When JWT is missing or invalid
  #
  def index
    insight = current_account.dashboard_insight

    TrackEvent.call("insights_viewed",
      user: current_user,
      account: current_account,
      insight_count: insight&.insights&.length || 0,
      triggered_regeneration: !insight&.fresh?)

    render json: serialize_insight(insight)
  end

  # POST /api/v1/dashboard_insights
  #
  # Creates or updates the dashboard insight for the account.
  # Called by Langgraph after generating insights.
  #
  # @param insights [Array<Hash>] Array of 3 insight objects
  # @param metrics_summary [Hash] The metrics used to generate insights (optional)
  # @return [201 Created | 200 OK] The saved insight
  # @return [422 Unprocessable Entity] When validation fails
  # @return [401 Unauthorized] When JWT is missing or invalid
  #
  def create
    insight = current_account.dashboard_insight || current_account.build_dashboard_insight

    insight.insights = create_params[:insights]
    insight.metrics_summary = create_params[:metrics_summary] if create_params[:metrics_summary].present?
    insight.generated_at = Time.current

    if insight.save
      # Invalidate dashboard cache so new insights are reflected immediately
      Analytics::CacheService.clear_for_account(current_account.id)

      status = insight.previously_new_record? ? :created : :ok
      render json: serialize_insight(insight), status: status
    else
      render json: { errors: insight.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/dashboard_insights/metrics_summary
  #
  # Returns the metrics summary for insight generation.
  # Called by Langgraph to get input data for the insights graph.
  #
  # @return [200 OK] Metrics summary from InsightsMetricsService
  # @return [401 Unauthorized] When JWT is missing or invalid
  #
  def metrics_summary
    dashboard_service = Analytics::DashboardService.new(current_account, days: 30, status_filter: "all")
    insights_metrics_service = Analytics::InsightsMetricsService.new(dashboard_service)

    render json: insights_metrics_service.summary
  end

  private

  def serialize_insight(insight)
    {
      id: insight&.id,
      insights: insight&.insights,
      generated_at: insight&.generated_at,
      fresh: insight&.fresh? || false,
      metrics_summary: insight&.metrics_summary
    }
  end

  def create_params
    permitted = params.require(:dashboard_insight).permit(
      insights: [
        :title,
        :description,
        :sentiment,
        :project_uuid,
        { action: [:label, :url] }
      ]
    )

    # metrics_summary is from our own Langgraph backend (protected by internal API signature)
    if params[:dashboard_insight][:metrics_summary].present?
      permitted[:metrics_summary] = params[:dashboard_insight][:metrics_summary].to_unsafe_h
    end

    permitted
  end
end
