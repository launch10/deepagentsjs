class API::V1::DeploysController < API::BaseController
  DEPLOYS_PER_PAGE = 5

  # GET /api/v1/deploys
  # Lists deploys for a project, paginated. Supports filtering by deploy_type and status.
  def index
    project = current_account.projects.find(params[:project_id])
    scope = project.deploys.where.not(status: "pending").order(created_at: :desc)

    scope = scope.where(deploy_type: params[:deploy_type]) if params[:deploy_type].present?
    scope = scope.where(status: params[:status]) if params[:status].present?

    @pagy, @deploys = pagy(scope, limit: DEPLOYS_PER_PAGE)

    render json: {
      deploys: @deploys.map { |d| deploy_json(d) },
      pagination: pagy_metadata(@pagy)
    }
  end

  # POST /api/v1/deploys
  # Creates a new deploy for a project.
  # thread_id is stored directly on the deploy record.
  def create
    project = current_account.projects.find(params[:project_id])

    # Idempotent: if an in-progress deploy exists, return it instead of creating a new one
    existing = project.deploys.active.in_progress.first
    if existing
      return render json: deploy_json(existing), status: :ok
    end

    deploy = project.deploys.create!(
      status: "pending",
      thread_id: params[:thread_id],
      deploy_type: params[:deploy_type].presence || "website"
    )

    render json: deploy_json(deploy), status: :created
  rescue ActiveRecord::RecordNotUnique
    # TOCTOU: another thread created the deploy between our check and insert.
    # The unique index on (project_id, active) caught it — return the winner.
    existing = project.deploys.active.in_progress.first!
    render json: deploy_json(existing), status: :ok
  end

  # GET /api/v1/deploys/:id
  # Returns deploy details
  def show
    deploy = find_deploy
    render json: deploy_json(deploy)
  end

  # PATCH /api/v1/deploys/:id
  # Updates deploy status, step, etc.
  # Pass needs_support: true to auto-create a support ticket on failure.
  def update
    deploy = find_deploy
    deploy.needs_support = ActiveModel::Type::Boolean.new.cast(params[:needs_support])
    deploy.update!(deploy_params)

    render json: deploy_json(deploy)
  end

  # POST /api/v1/deploys/deactivate
  # Deactivates the active deploy for a project. Takes project_id (not deploy id)
  # because the deploy prop may be stale on the frontend after the graph creates one.
  # On page reload, useDeployInit sees no active deploy and auto-starts fresh.
  def deactivate
    project = current_account.projects.find(params[:project_id])
    deploy = project.deploys.find_by(active: true)
    deploy&.deactivate!

    render json: { success: true }
  end

  # POST /api/v1/deploys/:id/touch
  # Updates user_active_at to indicate user is still active on this deploy
  def touch
    deploy = find_deploy
    deploy.touch_user_active!

    render json: { touched_at: deploy.user_active_at }
  end

  # POST /api/v1/deploys/check_changes
  # Checks whether website files or campaign data have changed since last deploy
  def check_changes
    project = current_account.projects.find(params[:project_id])
    deploy_type = params[:deploy_type].presence || "website"
    result = {}

    website = project.website
    result[:website] = website ? website.files_changed? : true

    if deploy_type == "campaign"
      campaign = project.campaigns.first
      result[:campaign] = campaign ? campaign.campaign_changed? : true
    end

    render json: result
  end

  # POST /api/v1/deploys/:id/rollback
  # Delegates rollback to the linked website_deploy
  def rollback
    deploy = find_deploy
    wd = deploy.website_deploy

    unless wd&.status == "completed"
      return render json: { errors: ["Cannot rollback non-completed deploy"] }, status: :unprocessable_entity
    end

    if wd.is_preview?
      return render json: { errors: ["Cannot rollback preview deploys"] }, status: :unprocessable_entity
    end

    unless wd.revertible?
      return render json: { errors: ["Cannot rollback non-revertible deploy"] }, status: :unprocessable_entity
    end

    if wd.is_live?
      return render json: { errors: ["Cannot roll back any further!"] }, status: :unprocessable_entity
    end

    wd.rollback(async: true)

    render json: { success: true }
  end

  private

  def find_deploy
    Deploy.joins(:project)
      .where(projects: { account_id: current_account.id })
      .find(params[:id])
  end

  def deploy_params
    permitted = params.permit(:status, :current_step, :is_live, :stacktrace)

    # is_live can only be set to true if there's a completed website deploy
    if permitted[:is_live].present? && ActiveModel::Type::Boolean.new.cast(permitted[:is_live])
      deploy = find_deploy
      unless deploy.website_deploy&.status == "completed"
        permitted.delete(:is_live)
      end
    end

    permitted
  end

  def deploy_json(deploy)
    wd = deploy.website_deploy

    {
      id: deploy.id,
      project_id: deploy.project_id,
      status: deploy.status,
      current_step: deploy.current_step,
      is_live: deploy.is_live,
      thread_id: deploy.thread_id,
      deploy_type: deploy.deploy_type,
      instructions: deploy.instructions,
      support_ticket: deploy.support_request&.ticket_reference,
      finished_at: deploy.finished_at,
      duration: deploy.duration,
      # Website deploy fields for history/rollback
      revertible: wd&.revertible? || false,
      website_deploy_status: wd&.status,
      created_at: deploy.created_at,
      updated_at: deploy.updated_at
    }
  end

  def pagy_metadata(pagy)
    {
      current_page: pagy.page,
      total_pages: pagy.pages,
      total_count: pagy.count,
      prev_page: pagy.prev,
      next_page: pagy.next,
      from: pagy.from,
      to: pagy.to,
      series: pagy.series
    }
  end
end
