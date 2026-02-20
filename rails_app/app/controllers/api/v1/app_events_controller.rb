# frozen_string_literal: true

# Internal service endpoint for Langgraph to create AppEvent records.
#
# Called fire-and-forget by Langgraph's notifyRailsEvent function using
# internal service auth (signature verification without JWT).
#
class API::V1::AppEventsController < API::BaseController
  skip_before_action :require_api_authentication, only: [:create]
  before_action :verify_internal_service_call, only: [:create]

  def create
    event_name = params[:event_name]

    if event_name.blank?
      return render json: {error: "event_name is required"}, status: :unprocessable_entity
    end

    user = User.find_by(id: params[:user_id])
    project = Project.find_by(id: params[:project_id])

    TrackEvent.call(
      event_name,
      user: user,
      account: project&.account || user&.accounts&.first,
      project: project,
      website: project&.website,
      **sanitized_properties
    )

    head :accepted
  end

  private

  # Explicit allowlist of known tracking property keys.
  # Prevents permit! mass-assignment anti-pattern while supporting
  # the generic properties hash from Langgraph's notifyRailsEvent.
  ALLOWED_PROPERTY_KEYS = %i[
    chat_type thread_id deploy_status deploy_type failed_step
    daily_budget_cents project_uuid campaign_id website_id
    status error_message step node
  ].freeze

  def sanitized_properties
    raw = params[:properties]
    return {} unless raw.is_a?(ActionController::Parameters)

    raw.permit(*ALLOWED_PROPERTY_KEYS).to_h.symbolize_keys
  end
end
