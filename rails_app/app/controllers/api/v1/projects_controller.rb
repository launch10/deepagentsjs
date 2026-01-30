# frozen_string_literal: true

class API::V1::ProjectsController < API::BaseController
  include ProjectsPagination

  # GET /api/v1/projects
  #
  # Returns a paginated list of projects for the current account.
  # Projects are ordered by updated_at DESC (most recently updated first).
  #
  # @param page [Integer] Page number (default 1, 5 items per page)
  # @param status [String] Optional filter by status (draft, paused, live)
  #
  # @return [200 OK] Paginated list with pagination metadata
  # @return [401 Unauthorized] When JWT is missing or invalid
  #
  def index
    scope = current_account.projects
    scope = scope.where(status: params[:status]) if valid_status?

    @pagy, @projects = paginated_projects(scope)

    render json: {
      projects: @projects.map(&:to_mini_json),
      pagination: pagy_metadata(@pagy)
    }
  end

  private

  def valid_status?
    params[:status].present? && Project::STATUSES.include?(params[:status])
  end
end
