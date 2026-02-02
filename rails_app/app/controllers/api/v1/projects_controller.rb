# frozen_string_literal: true

class API::V1::ProjectsController < API::BaseController
  include ProjectsPagination

  before_action :set_project, only: [:destroy, :restore]

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
      pagination: pagy_metadata(@pagy),
      status_counts: status_counts
    }
  end

  # DELETE /api/v1/projects/:uuid
  #
  # Soft-deletes a project and all associated data.
  #
  # @return [204 No Content] Successfully deleted
  # @return [401 Unauthorized] When JWT is missing or invalid
  # @return [404 Not Found] When project not found
  #
  def destroy
    @project.destroy
    head :no_content
  end

  # PATCH /api/v1/projects/:uuid/restore
  #
  # Restores a soft-deleted project and all associated data.
  #
  # @return [200 OK] Successfully restored with project data
  # @return [401 Unauthorized] When JWT is missing or invalid
  # @return [404 Not Found] When project not found
  #
  def restore
    @project.restore
    render json: { project: @project.to_mini_json }
  end

  private

  def set_project
    @project = if action_name == "restore"
      current_account.projects.only_deleted.find_by(uuid: params[:uuid])
    else
      current_account.projects.find_by(uuid: params[:uuid])
    end
    render json: { error: "Project not found" }, status: :not_found unless @project
  end

  def valid_status?
    params[:status].present? && Project::STATUSES.include?(params[:status])
  end
end
