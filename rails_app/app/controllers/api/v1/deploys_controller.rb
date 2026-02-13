class API::V1::DeploysController < API::BaseController
  # POST /api/v1/deploys
  # Creates a new deploy for a project.
  # ChatCreatable auto-creates a Chat record using initial_thread_id.
  def create
    project = current_account.projects.find(params[:project_id])
    deploy = project.deploys.create!(
      status: "pending",
      initial_thread_id: params[:thread_id]
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
  def update
    deploy = find_deploy
    deploy.update!(deploy_params)

    render json: deploy_json(deploy)
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
      created_at: deploy.created_at,
      updated_at: deploy.updated_at
    }
  end
end
