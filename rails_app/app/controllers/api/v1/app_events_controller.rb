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
      **(params[:properties]&.permit!&.to_h || {}).symbolize_keys
    )

    head :accepted
  end
end
