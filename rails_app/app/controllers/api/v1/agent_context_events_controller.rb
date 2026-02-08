# frozen_string_literal: true

# Endpoint for Langgraph to fetch agent context events.
#
# GET /api/v1/agent_context_events - Get events for a project
#
class API::V1::AgentContextEventsController < API::BaseController
  # GET /api/v1/agent_context_events
  #
  # Returns context events for a project, optionally filtered.
  #
  # @param project_id [Integer] Required - The project to fetch events for
  # @param event_types [Array<String>] Optional - Event types to filter by
  # @param since [String] Optional - ISO8601 timestamp to filter events after
  #
  # @return [200 OK] Array of events
  # @return [400 Bad Request] When project_id is missing
  # @return [401 Unauthorized] When JWT is missing or invalid
  # @return [404 Not Found] When project is not found
  #
  def index
    if params[:project_id].blank?
      return render json: { errors: ["project_id is required"] }, status: :bad_request
    end

    project = current_account.projects.find_by(id: params[:project_id])
    return render json: { error: "Project not found" }, status: :not_found unless project

    events = current_account.agent_context_events
      .for_project(project.id)
      .of_types(params[:event_types])
      .since(parse_since_timestamp)
      .chronological
      .limit(100)

    render json: events.map { |e| serialize_event(e) }
  end

  private

  def parse_since_timestamp
    Time.iso8601(params[:since]) if params[:since].present?
  rescue ArgumentError
    nil
  end

  def serialize_event(event)
    {
      id: event.id,
      event_type: event.event_type,
      payload: event.payload,
      created_at: event.created_at.iso8601
    }
  end
end
