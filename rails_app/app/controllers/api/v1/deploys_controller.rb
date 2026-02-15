class API::V1::DeploysController < API::BaseController
  # POST /api/v1/deploys
  # Creates a new deploy for a project.
  # thread_id is stored directly on the deploy record.
  def create
    project = current_account.projects.find(params[:project_id])
    deploy = project.deploys.create!(
      status: "pending",
      thread_id: params[:thread_id]
    )

    render json: deploy_json(deploy), status: :created
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

  private

  def find_deploy
    Deploy.joins(:project)
      .where(projects: { account_id: current_account.id })
      .find(params[:id])
  end

  def deploy_params
    params.permit(:status, :current_step, :is_live, :stacktrace)
  end

  def deploy_json(deploy)
    {
      id: deploy.id,
      project_id: deploy.project_id,
      status: deploy.status,
      current_step: deploy.current_step,
      is_live: deploy.is_live,
      thread_id: deploy.thread_id,
      support_ticket: deploy.support_request&.ticket_reference,
      created_at: deploy.created_at,
      updated_at: deploy.updated_at
    }
  end
end
